"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "./I18nProvider";
import TagFieldsEditor from "./TagFieldsEditor";
import RatingPicker from "./RatingPicker";
import { joinTagFields, type Rating, type TagFields } from "@/lib/tags";
import { formatBytes, type Dict } from "@/lib/i18n/dict";
import { errorText, send, uploadChunks } from "@/lib/clientUpload";

type Mode = "image" | "gif" | "video" | "doujin";

const MODES: Mode[] = ["image", "gif", "video", "doujin"];

const ACCEPT: Record<Mode, string> = {
  image: "image/*",
  gif: ".gif,image/gif",
  video: "video/*",
  doujin: ".zip,.cbz,application/zip,application/x-zip-compressed",
};

const MULTI: Record<Mode, boolean> = { image: true, gif: true, video: false, doujin: true };

interface Job {
  key: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  /** transient status text next to the percentage (retrying, processing…) */
  note?: string;
  id?: number;
  error?: string;
}

type Progress = (pct: number, note?: string) => void;

/**
 * Chunked upload (see lib/chunks.ts and lib/clientUpload.ts), then /api/upload
 * assembles and processes it. Works for multi-GB files and behind proxies that
 * cap request size.
 */
async function uploadOne(
  job: Job,
  mode: Mode,
  tags: string,
  meta: { rating: Rating; source: string },
  t: Dict,
  onProgress: Progress
): Promise<{ id?: number; error?: string }> {
  const file = job.file;
  const up = await uploadChunks(file, (id, i) => `/api/upload/chunk?id=${id}&index=${i}`, t, onProgress);
  if ("error" in up) return up;

  onProgress(99, t.upload.processing);
  const r = await send<{ id?: number }>(
    "POST",
    "/api/upload",
    JSON.stringify({ ...up, name: file.name, type: mode, tags, ...meta }),
    "application/json"
  );
  if (r.status >= 200 && r.status < 300 && r.data.id) return { id: r.data.id };
  return { error: errorText(t, r.status, r.data.error) };
}

export default function UploadClient() {
  const router = useRouter();
  const t = useT();
  const [mode, setMode] = useState<Mode>("image");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [tagFields, setTagFields] = useState<TagFields>({ tags: "", parodies: "", characters: "" });
  const [rating, setRating] = useState<Rating>("g");
  const [source, setSource] = useState("");
  const [drag, setDrag] = useState(false);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const doneJobs = useMemo(() => jobs.filter((j) => j.status === "done"), [jobs]);

  function addFiles(list: FileList | null) {
    if (!list || !list.length) return;
    const picked = MULTI[mode] ? Array.from(list) : [list[0]];
    const next: Job[] = picked.map((file, i) => ({
      key: `${Date.now()}-${i}-${file.name}`,
      file,
      status: "pending",
      progress: 0,
    }));
    setJobs((prev) => (MULTI[mode] ? [...prev, ...next] : next));
    setFinished(false);
  }

  function removeJob(key: string) {
    setJobs((prev) => prev.filter((j) => j.key !== key));
  }

  function reset() {
    setJobs([]);
    setFinished(false);
  }

  function patch(key: string, p: Partial<Job>) {
    setJobs((prev) => prev.map((j) => (j.key === key ? { ...j, ...p } : j)));
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!jobs.length || running) return;
    setRunning(true);
    setFinished(false);

    const results: Job[] = [];
    for (const job of jobs) {
      if (job.status === "done") {
        results.push(job);
        continue;
      }
      patch(job.key, { status: "uploading", progress: 0, error: undefined });
      const r = await uploadOne(
        job,
        mode,
        joinTagFields(tagFields),
        { rating, source },
        t,
        (pct, note) => patch(job.key, { progress: pct, note })
      );
      if (r.id) {
        patch(job.key, { status: "done", progress: 100, id: r.id, note: undefined });
        results.push({ ...job, status: "done", id: r.id });
      } else {
        patch(job.key, { status: "error", error: r.error, note: undefined });
        results.push({ ...job, status: "error", error: r.error });
      }
    }

    setRunning(false);
    setFinished(true);

    const ok = results.filter((r) => r.status === "done");
    if (ok.length === 1 && results.length === 1) {
      router.push(`/post/${ok[0].id}`);
      router.refresh();
    } else {
      router.refresh();
    }
  }

  return (
    <form className="upload-form" onSubmit={start}>
      <div className="type-switch">
        {MODES.map((m) => (
          <button
            type="button"
            key={m}
            className={mode === m ? "active" : ""}
            onClick={() => {
              setMode(m);
              reset();
            }}
          >
            {t.upload.modes[m].name}
            <small>{t.upload.modes[m].sub}</small>
          </button>
        ))}
      </div>

      <div
        className={`dropzone${drag ? " drag" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <strong>{MULTI[mode] ? t.upload.dropMany : t.upload.dropOne}</strong> {t.upload.orClick}
        <br />
        <span>{t.upload.hints[mode]}</span>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT[mode]}
          multiple={MULTI[mode]}
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {jobs.length > 0 && (
        <ul className="job-list">
          {jobs.map((j) => (
            <li key={j.key} className={`job ${j.status}`}>
              <div className="job-head">
                <span className="job-name">{j.file.name}</span>
                <span className="job-meta">
                  {j.status === "done" && j.id ? (
                    <Link href={`/post/${j.id}`}>{t.upload.view}</Link>
                  ) : j.status === "error" ? (
                    <span className="job-err">{j.error}</span>
                  ) : j.status === "uploading" ? (
                    j.note ? `${j.progress}% · ${j.note}` : `${j.progress}%`
                  ) : (
                    formatBytes(t, j.file.size)
                  )}
                  {!running && j.status !== "done" && (
                    <button
                      type="button"
                      className="job-x"
                      onClick={() => removeJob(j.key)}
                      aria-label={t.upload.remove}
                    >
                      ✕
                    </button>
                  )}
                </span>
              </div>
              {(j.status === "uploading" || j.status === "done") && (
                <div className="progress">
                  <div style={{ width: `${j.progress}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {jobs.length > 1 && (
        <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", margin: 0 }}>
          {t.upload.multiNote(jobs.length)}
        </p>
      )}

      <TagFieldsEditor value={tagFields} onChange={setTagFields} />

      <div className="field">
        <label>{t.fields.rating}</label>
        <RatingPicker value={rating} onChange={setRating} />
      </div>

      <div className="field">
        <label htmlFor="source">{t.fields.source}</label>
        <input
          id="source"
          type="text"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder={t.fields.sourcePlaceholder}
        />
      </div>

      {finished && doneJobs.length > 0 && (
        <div className="msg ok">
          {t.upload.done(doneJobs.length)} <Link href="/">{t.upload.seeGallery}</Link>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="submit"
          className="btn btn-accent"
          disabled={running || jobs.length === 0}
          style={{ flex: 1 }}
        >
          {running
            ? t.upload.uploading
            : jobs.length > 1
              ? t.upload.uploadN(jobs.length)
              : t.upload.uploadOne}
        </button>
        {jobs.length > 0 && !running && (
          <button type="button" className="btn" onClick={reset}>
            {t.upload.clear}
          </button>
        )}
      </div>
    </form>
  );
}
