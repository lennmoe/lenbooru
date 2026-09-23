"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Post, PostType } from "@/lib/db";
import { RATINGS, type Rating, displayTag } from "@/lib/tags";
import { formatBytes } from "@/lib/i18n/dict";
import { useT } from "./I18nProvider";
import TagAutocomplete from "./TagAutocomplete";

const TYPES: PostType[] = ["image", "gif", "video", "doujin"];
const LIMIT = 50;

/** Admin > Posts: filterable table with bulk actions on the selection. */
export default function AdminPosts() {
  const t = useT();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<PostType | "">("");
  const [offset, setOffset] = useState(0);
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rating, setRating] = useState<Rating>("g");
  const [tagText, setTagText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ q: query, offset: String(offset), limit: String(LIMIT) });
    if (type) qs.set("type", type);
    const r = await fetch(`/api/admin/posts?${qs}`);
    if (!r.ok) return;
    const d = await r.json();
    setPosts(d.posts);
    setTotal(d.total);
  }, [query, type, offset]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(id: number) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function bulk(action: "rating" | "addTags" | "removeTags" | "delete", value?: string) {
    const ids = [...selected];
    if (!ids.length) return;
    if (action === "delete" && !confirm(t.admin.posts.deleteConfirm(ids.length))) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action, value }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg({ ok: false, text: d.error || t.common.error(r.status) });
        return;
      }
      setMsg({ ok: true, text: action === "delete" ? t.admin.posts.deleted(d.count) : t.admin.posts.done(d.count) });
      if (action === "delete") setSelected(new Set());
      if (action === "addTags" || action === "removeTags") setTagText("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const page = Math.floor(offset / LIMIT) + 1;
  const allOnPage = posts.length > 0 && posts.every((p) => selected.has(p.id));

  return (
    <div className="admin-block">
      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setOffset(0);
          setQuery(q);
        }}
      >
        <TagAutocomplete value={q} onChange={setQ} placeholder={t.admin.posts.search} />
        <select
          value={type}
          onChange={(e) => {
            setOffset(0);
            setType(e.target.value as PostType | "");
          }}
        >
          <option value="">{t.admin.posts.allTypes}</option>
          {TYPES.map((ty) => (
            <option key={ty} value={ty}>
              {t.info.types[ty]}
            </option>
          ))}
        </select>
        <button type="submit" className="btn">
          OK
        </button>
      </form>

      <div className="admin-bulk">
        <span className="admin-count">
          {selected.size ? t.admin.posts.selected(selected.size) : t.admin.posts.total(total)}
        </span>
        {selected.size > 0 && (
          <>
            <button type="button" className="linklike-btn" onClick={() => setSelected(new Set())}>
              {t.admin.posts.clear}
            </button>
            <span className="admin-bulk-group">
              <select value={rating} onChange={(e) => setRating(e.target.value as Rating)} aria-label={t.admin.posts.setRating}>
                {RATINGS.map((r) => (
                  <option key={r} value={r}>
                    {t.ratings[r]}
                  </option>
                ))}
              </select>
              <button type="button" className="btn" disabled={busy} onClick={() => bulk("rating", rating)}>
                {t.admin.posts.setRating}
              </button>
            </span>
            <span className="admin-bulk-group admin-bulk-tags">
              <TagAutocomplete value={tagText} onChange={setTagText} placeholder={t.admin.posts.tagsPlaceholder} />
              <button type="button" className="btn" disabled={busy || !tagText.trim()} onClick={() => bulk("addTags", tagText)}>
                {t.admin.posts.addTags}
              </button>
              <button type="button" className="btn" disabled={busy || !tagText.trim()} onClick={() => bulk("removeTags", tagText)}>
                {t.admin.posts.removeTags}
              </button>
            </span>
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => bulk("delete")}>
              {t.admin.posts.delete}
            </button>
          </>
        )}
      </div>
      {msg && <div className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}

      <table className="admin-table">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={allOnPage}
                aria-label={t.admin.posts.selectPage}
                title={t.admin.posts.selectPage}
                onChange={() =>
                  setSelected((s) => {
                    const n = new Set(s);
                    for (const p of posts) {
                      if (allOnPage) n.delete(p.id);
                      else n.add(p.id);
                    }
                    return n;
                  })
                }
              />
            </th>
            <th />
            <th>{t.info.id}</th>
            <th>{t.info.type}</th>
            <th>{t.info.rating}</th>
            <th className="admin-tags-col">Tags</th>
            <th>{t.info.size}</th>
            <th>{t.info.uploader}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {posts.map((p) => (
            <tr key={p.id} className={selected.has(p.id) ? "selected" : ""} onClick={() => toggle(p.id)}>
              <td onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={`#${p.id}`} />
              </td>
              <td>
                <span className="admin-thumb card" data-rating={p.rating || "none"}>
                  {p.type === "video" ? (
                    <video src={`/media/video/${p.id}.${p.ext}#t=0.1`} muted preload="metadata" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/media/thumb/${p.id}.webp`} alt="" loading="lazy" />
                  )}
                </span>
              </td>
              <td>#{p.id}</td>
              <td>{t.info.types[p.type]}</td>
              <td>
                {p.rating ? (
                  <span className={`rating-text rating-${p.rating}`}>{t.ratings[p.rating]}</span>
                ) : (
                  <span className="dim">{t.info.unrated}</span>
                )}
              </td>
              <td className="admin-tags-col">
                {p.tags.length ? p.tags.map(displayTag).join(", ") : <span className="dim">{t.admin.posts.noTags}</span>}
              </td>
              <td>{formatBytes(t, p.size)}</td>
              <td>{p.uploader || <span className="dim">—</span>}</td>
              <td onClick={(e) => e.stopPropagation()}>
                <Link href={`/post/${p.id}/edit`}>{t.admin.posts.edit}</Link>
              </td>
            </tr>
          ))}
          {!posts.length && (
            <tr>
              <td colSpan={9} className="dim">
                {t.admin.posts.none}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {pages > 1 && (
        <div className="admin-pager">
          <button type="button" className="btn" disabled={page <= 1} onClick={() => setOffset(offset - LIMIT)}>
            {t.admin.posts.prev}
          </button>
          <span>{t.admin.posts.page(page, pages)}</span>
          <button type="button" className="btn" disabled={page >= pages} onClick={() => setOffset(offset + LIMIT)}>
            {t.admin.posts.next}
          </button>
        </div>
      )}
    </div>
  );
}
