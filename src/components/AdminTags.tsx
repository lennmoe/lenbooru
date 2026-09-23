"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { TagInfo } from "@/lib/db";
import { TAG_CATEGORIES, type TagCategory, displayTag } from "@/lib/tags";
import { useT } from "./I18nProvider";

/** Admin > Tags: rename / merge, change category, delete. */
export default function AdminTags() {
  const t = useT();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<TagCategory | "">("");
  const [sort, setSort] = useState<"count" | "name">("count");
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(
    async (append = false, from = 0) => {
      const qs = new URLSearchParams({ q, sort, offset: String(from) });
      if (category) qs.set("category", category);
      const r = await fetch(`/api/admin/tags?${qs}`);
      if (!r.ok) return;
      const d = await r.json();
      setTags((cur) => (append ? [...cur, ...d.tags] : d.tags));
      setTotal(d.total);
    },
    [q, category, sort]
  );

  // debounce the text filter
  useEffect(() => {
    const id = setTimeout(() => load(), 200);
    return () => clearTimeout(id);
  }, [load]);

  async function patch(name: string, body: { newName?: string; category?: TagCategory }) {
    setMsg(null);
    const r = await fetch("/api/admin/tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ...body }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMsg({ ok: false, text: d.error || t.common.error(r.status) });
      return;
    }
    if (body.newName) {
      const to = body.newName.trim().toLowerCase();
      setMsg({ ok: true, text: d.merged ? t.admin.tags.merged(name, to) : t.admin.tags.renamed(name, to) });
    }
    await load();
  }

  async function rename(tag: TagInfo) {
    const next = prompt(t.admin.tags.renamePrompt(tag.name), tag.name);
    if (next && next.trim().toLowerCase() !== tag.name) await patch(tag.name, { newName: next });
  }

  async function remove(tag: TagInfo) {
    if (!confirm(t.admin.tags.deleteConfirm(tag.name, tag.count))) return;
    await fetch(`/api/admin/tags?name=${encodeURIComponent(tag.name)}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="admin-block">
      <div className="admin-filters">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.admin.tags.search} />
        <select value={category} onChange={(e) => setCategory(e.target.value as TagCategory | "")}>
          <option value="">{t.admin.tags.allCats}</option>
          {TAG_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t.tagCats[c]}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as "count" | "name")}>
          <option value="count">{t.admin.tags.sortCount}</option>
          <option value="name">{t.admin.tags.sortName}</option>
        </select>
      </div>
      <p className="admin-count">{t.admin.tags.total(total)}</p>
      {msg && <div className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Tag</th>
            <th>{t.admin.tags.category}</th>
            <th>{t.admin.stats.posts}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {tags.map((tag) => (
            <tr key={tag.name}>
              <td>
                <Link href={`/?tags=${encodeURIComponent(tag.name)}`} className={`tag-${tag.category}`}>
                  {displayTag(tag.name)}
                </Link>
              </td>
              <td>
                <select
                  value={tag.category}
                  onChange={(e) => patch(tag.name, { category: e.target.value as TagCategory })}
                  aria-label={t.admin.tags.category}
                >
                  {TAG_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t.tagCats[c]}
                    </option>
                  ))}
                </select>
              </td>
              <td>{tag.count}</td>
              <td className="admin-actions">
                <button type="button" className="linklike-btn" onClick={() => rename(tag)}>
                  {t.admin.tags.rename}
                </button>
                <button type="button" className="linklike-btn danger" onClick={() => remove(tag)}>
                  {t.admin.tags.delete}
                </button>
              </td>
            </tr>
          ))}
          {!tags.length && (
            <tr>
              <td colSpan={4} className="dim">
                {t.admin.tags.none}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {tags.length < total && (
        <button type="button" className="btn" onClick={() => load(true, tags.length)}>
          {t.admin.tags.more}
        </button>
      )}
    </div>
  );
}
