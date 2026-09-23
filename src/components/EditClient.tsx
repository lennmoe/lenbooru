"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "./I18nProvider";

export default function EditClient({
  id,
  title: initialTitle,
  tags: initialTags,
  type,
}: {
  id: number;
  title: string;
  tags: string[];
  type: string;
}) {
  const router = useRouter();
  const t = useT();
  const [title, setTitle] = useState(initialTitle);
  const [tags, setTags] = useState(initialTags.join(" "));
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
      body: JSON.stringify({ title, tags }),
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

      <div className="field">
        <label htmlFor="title">{t.common.title}</label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="tags">{t.post.tagsField}</label>
        <textarea
          id="tags"
          rows={3}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
      </div>

      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

      <button type="submit" className="btn btn-accent" disabled={busy}>
        {busy ? t.common.saving : t.common.save}
      </button>
    </form>
  );
}
