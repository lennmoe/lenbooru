import { getDb, getPost, deletePost, linkTags, pruneOrphanTags, type TagInfo } from "./db";
import { removePostFiles } from "./media";
import { parseTag, type Rating, type TagCategory } from "./tags";

/** Admin page (owner only): tag management and bulk post actions. */

export type TagSort = "count" | "name";

/** All tags with their post count, optionally filtered by a substring / category. */
export function listAllTags(opts: {
  q?: string;
  category?: TagCategory | null;
  sort?: TagSort;
  offset?: number;
  limit?: number;
}): { tags: TagInfo[]; total: number } {
  const { q = "", category = null, sort = "count", offset = 0, limit = 100 } = opts;
  const where: string[] = [];
  const params: Record<string, unknown> = { offset, limit };
  if (q) {
    where.push("t.name LIKE @q ESCAPE '!'");
    params.q = `%${q.replace(/[!%_]/g, (c) => "!" + c)}%`;
  }
  if (category) {
    where.push("t.category = @category");
    params.category = category;
  }
  const w = where.length ? "WHERE " + where.join(" AND ") : "";
  const db = getDb();
  const tags = db
    .prepare(
      `SELECT t.name, t.category, COUNT(pt.post_id) AS count
       FROM tags t LEFT JOIN post_tags pt ON pt.tag_id = t.id
       ${w}
       GROUP BY t.id
       ORDER BY ${sort === "name" ? "t.name" : "count DESC, t.name"}
       LIMIT @limit OFFSET @offset`
    )
    .all(params) as TagInfo[];
  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM tags t ${w}`).get(params) as { n: number };
  return { tags, total: n };
}

export function setTagCategory(name: string, category: TagCategory): boolean {
  return getDb().prepare("UPDATE tags SET category = ? WHERE name = ?").run(category, name).changes > 0;
}

/**
 * Rename a tag. If the new name already exists, the two tags are merged: every
 * post of the old tag gets the existing one, and the old tag disappears.
 */
export function renameTag(from: string, toRaw: string): { ok: boolean; merged: boolean } {
  const to = parseTag(toRaw).name;
  if (!to || to === from || /[\s,]/.test(to)) return { ok: false, merged: false };
  const db = getDb();
  return db.transaction(() => {
    const src = db.prepare("SELECT id FROM tags WHERE name = ?").get(from) as { id: number } | undefined;
    if (!src) return { ok: false, merged: false };
    const dst = db.prepare("SELECT id FROM tags WHERE name = ?").get(to) as { id: number } | undefined;
    if (!dst) {
      db.prepare("UPDATE tags SET name = ? WHERE id = ?").run(to, src.id);
      return { ok: true, merged: false };
    }
    db.prepare(
      "INSERT OR IGNORE INTO post_tags (post_id, tag_id) SELECT post_id, ? FROM post_tags WHERE tag_id = ?"
    ).run(dst.id, src.id);
    db.prepare("DELETE FROM tags WHERE id = ?").run(src.id); // cascades post_tags
    return { ok: true, merged: true };
  })();
}

/** Remove a tag from every post and delete it. */
export function deleteTag(name: string): boolean {
  return getDb().prepare("DELETE FROM tags WHERE name = ?").run(name).changes > 0;
}

export type BulkAction =
  | { action: "rating"; value: Rating }
  | { action: "addTags"; value: string[] }
  | { action: "removeTags"; value: string[] }
  | { action: "delete" };

/** Apply one action to many posts at once. Returns how many posts were touched. */
export function bulkPosts(ids: number[], op: BulkAction): number {
  const db = getDb();
  const valid = ids.filter((id) => Number.isInteger(id) && id > 0).slice(0, 500);
  if (!valid.length) return 0;

  if (op.action === "delete") {
    let n = 0;
    for (const id of valid) {
      const post = getPost(id);
      if (!post) continue;
      deletePost(id);
      removePostFiles(post);
      n++;
    }
    return n;
  }

  return db.transaction(() => {
    let n = 0;
    for (const id of valid) {
      if (!db.prepare("SELECT 1 FROM posts WHERE id = ?").get(id)) continue;
      if (op.action === "rating") {
        db.prepare("UPDATE posts SET rating = ? WHERE id = ?").run(op.value, id);
      } else if (op.action === "addTags") {
        linkTags(db, id, op.value);
      } else {
        const names = op.value.map((t) => parseTag(t).name).filter(Boolean);
        if (names.length) {
          db.prepare(
            `DELETE FROM post_tags WHERE post_id = ? AND tag_id IN
             (SELECT id FROM tags WHERE name IN (${names.map(() => "?").join(",")}))`
          ).run(id, ...names);
        }
      }
      n++;
    }
    if (op.action === "removeTags") pruneOrphanTags(db);
    return n;
  })();
}

/** Numbers for the admin overview. */
export function adminStats(): { posts: number; tags: number; members: number; messages: number } {
  const db = getDb();
  const one = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  return {
    posts: one("SELECT COUNT(*) AS n FROM posts"),
    tags: one("SELECT COUNT(*) AS n FROM tags"),
    members: one("SELECT COUNT(*) AS n FROM users"),
    messages: one("SELECT COUNT(*) AS n FROM chat_messages"),
  };
}
