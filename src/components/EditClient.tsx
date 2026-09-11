"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
      setMsg({ kind: "err", text: data.error || `Erreur ${res.status}` });
      setBusy(false);
    }
  }

  return (
    <form className="upload-form" onSubmit={save}>
      <h1 style={{ fontSize: "1.15rem", margin: 0 }}>Éditer le post #{id}</h1>
      <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", margin: 0 }}>
        Type&nbsp;: {type}
      </p>

      <div className="field">
        <label htmlFor="title">Titre</label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="tags">Tags (espaces ou virgules)</label>
        <textarea
          id="tags"
          rows={3}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
      </div>

      {msg && <div className={`msg ${msg.kind}`}>{msg.text}</div>}

      <button type="submit" className="btn btn-accent" disabled={busy}>
        {busy ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
