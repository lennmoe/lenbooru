"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "./I18nProvider";
import TagFieldsEditor from "./TagFieldsEditor";
import RatingPicker from "./RatingPicker";
import { joinTagFields, type Rating, type TagFields } from "@/lib/tags";

export default function EditClient({
  id,
  tags: initialTags,
  rating: initialRating,
  source: initialSource,
  type,
}: {
  id: number;
  tags: TagFields;
  rating: Rating | "";
  source: string;
  type: string;
}) {
  const router = useRouter();
  const t = useT();
  const [tagFields, setTagFields] = useState<TagFields>(initialTags);
  const [rating, setRating] = useState<Rating | "">(initialRating);
  const [source, setSource] = useState(initialSource);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(
    null
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: joinTagFields(tagFields), rating, source }),
    });
    if (res.ok) {
      router.push(`/post/${id}`);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMsg({ kind: "err", text: data.error || t.common.error(res.status) });
      setBusy(false);
    }
  }

  return (
    <form className="upload-form" onSubmit={save}>
      <h1 style={{ fontSize: "1.15rem", margin: 0 }}>{t.post.editTitle(id)}</h1>
      <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", margin: 0 }}>
        {t.post.type}&nbsp;: {type}
      </p>

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

      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

      <button type="submit" className="btn btn-accent" disabled={busy}>
        {busy ? t.common.saving : t.common.save}
      </button>
    </form>
  );
}
