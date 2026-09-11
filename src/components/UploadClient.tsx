"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "image" | "video" | "doujin";

const ACCEPT: Record<Mode, string> = {
  image: "image/*",
  video: "video/*",
  doujin: ".zip,.cbz,application/zip,application/x-zip-compressed",
};

const HINT: Record<Mode, string> = {
  image: "JPG, PNG, GIF, WebP, AVIF… — plusieurs fichiers possible",
  video: "MP4, WebM, MOV, MKV… — un seul fichier",
  doujin:
    "Un ou plusieurs .zip / .cbz — images nommées 1, 2, 3… (l’image 1 = couverture)",
};

const MULTI: Record<Mode, boolean> = { image: true, video: false, doujin: true };

interface Job {
  key: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  id?: number;
  error?: string;
}

function uploadOne(
  job: Job,
  mode: Mode,
  tags: string,
  title: string,
  onProgress: (pct: number) => void
): Promise<{ id?: number; error?: string }> {
  return new Promise((resolve) => {
    const fd = new FormData();
    fd.set("type", mode);
    fd.set("title", title);
    fd.set("tags", tags);
    fd.set("file", job.file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      let data: { id?: number; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* noop */
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.id) resolve({ id: data.id });
      else resolve({ error: data.error || `Erreur ${xhr.status}` });
    };
    xhr.onerror = () => resolve({ error: "Erreur réseau" });
    xhr.send(fd);
  });
}

export default function UploadClient() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("image");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [drag, setDrag] = useState(false);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const single = jobs.length === 1;
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
    if (next.length === 1 && !title) {
      setTitle(next[0].file.name.replace(/\.[^.]+$/, ""));
    }
  }

  function removeJob(key: string) {
    setJobs((prev) => prev.filter((j) => j.key !== key));
  }

  function reset() {
    setJobs([]);
    setTitle("");
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
        tags,
        single ? title : job.file.name.replace(/\.[^.]+$/, ""),
        (pct) => patch(job.key, { progress: pct })
      );
      if (r.id) {
        patch(job.key, { status: "done", progress: 100, id: r.id });
        results.push({ ...job, status: "done", id: r.id });
      } else {
        patch(job.key, { status: "error", error: r.error });
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
        {(["image", "video", "doujin"] as Mode[]).map((m) => (
          <button
            type="button"
            key={m}
            className={mode === m ? "active" : ""}
            onClick={() => {
              setMode(m);
              reset();
            }}
          >
            {m === "image" ? "🖼️ Image" : m === "video" ? "🎬 Vidéo" : "📚 Doujin"}
            <small>{m === "doujin" ? "zip / cbz" : m}</small>
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
        <strong>Glisse {MULTI[mode] ? "un ou plusieurs fichiers" : "un fichier"} ici</strong>{" "}
        ou clique
        <br />
        <span>{HINT[mode]}</span>
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
                    <Link href={`/post/${j.id}`}>voir →</Link>
                  ) : j.status === "error" ? (
                    <span className="job-err">{j.error}</span>
                  ) : j.status === "uploading" ? (
                    `${j.progress}%`
                  ) : (
                    `${(j.file.size / 1024 / 1024).toFixed(1)} Mo`
                  )}
                  {!running && j.status !== "done" && (
                    <button
                      type="button"
                      className="job-x"
                      onClick={() => removeJob(j.key)}
                      aria-label="retirer"
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

      {single && (
        <div className="field">
          <label htmlFor="title">Titre</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre du post"
          />
        </div>
      )}
      {jobs.length > 1 && (
        <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", margin: 0 }}>
          {jobs.length} fichiers — le titre de chacun sera son nom de fichier.
        </p>
      )}

      <div className="field">
        <label htmlFor="tags">Tags communs (espaces ou virgules)</label>
        <textarea
          id="tags"
          rows={2}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="school_uniform, blonde, vanilla"
        />
      </div>

      {finished && doneJobs.length > 0 && (
        <div className="msg ok">
          {doneJobs.length} import(s) réussi(s).{" "}
          <Link href="/">Voir la galerie →</Link>
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
            ? "Upload en cours…"
            : jobs.length > 1
              ? `Uploader ${jobs.length} fichiers`
              : "Uploader"}
        </button>
        {jobs.length > 0 && !running && (
          <button type="button" className="btn" onClick={reset}>
            Vider
          </button>
        )}
      </div>
    </form>
  );
}
