import Database from "better-sqlite3";
import path from "node:path";
import { DATA_DIR, ensureDirs } from "./paths";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS posts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL DEFAULT '',
  ext         TEXT NOT NULL DEFAULT '',
  page_count  INTEGER NOT NULL DEFAULT 0,
  width       INTEGER,
  height      INTEGER,
  size        INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS post_tags (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE IF NOT EXISTS doujin_pages (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  page_no INTEGER NOT NULL,
  file    TEXT NOT NULL,
  PRIMARY KEY (post_id, page_no)
);

CREATE TABLE IF NOT EXISTS users (
  discord_id TEXT PRIMARY KEY,
  username   TEXT NOT NULL DEFAULT '',
  role       TEXT NOT NULL DEFAULT 'viewer',
  added_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(type);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag_id);
`;

let _db: Database.Database | null = null;

/**
 * Lazily open the SQLite database. Nothing touches the DB at import time so that
 * `next build` (which imports route modules in parallel workers) never races on
 * the WAL-mode switch / schema creation.
 */
export function getDb(): Database.Database {
  if (_db) return _db;
  ensureDirs();
  const db = new Database(path.join(DATA_DIR, "lenbooru.db"), { timeout: 15000 });
  if (db.pragma("journal_mode", { simple: true }) !== "wal") {
    db.pragma("journal_mode = WAL");
  }
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 15000");
  db.exec(SCHEMA);
  _db = db;
  return _db;
}

export type PostType = "image" | "video" | "doujin";

export interface PostRow {
  id: number;
  type: PostType;
  title: string;
  ext: string;
  page_count: number;
  width: number | null;
  height: number | null;
  size: number;
  created_at: number;
}

export interface Post extends PostRow {
  tags: string[];
}

const PAGE_SIZE = 60;

interface ListOpts {
  type?: PostType | null;
  tags?: string[];
  offset?: number;
  limit?: number;
}

function attachTags(row: PostRow): Post {
  const tags = getDb()
    .prepare(
      `SELECT t.name FROM tags t
       JOIN post_tags pt ON pt.tag_id = t.id
       WHERE pt.post_id = ? ORDER BY t.name`
    )
    .all(row.id)
    .map((r) => (r as { name: string }).name);
  return { ...row, tags };
}

export function listPosts(opts: ListOpts = {}): Post[] {
  const { type = null, tags = [], offset = 0, limit = PAGE_SIZE } = opts;
  const where: string[] = [];
  const params: Record<string, unknown> = { offset, limit };

  if (type) {
    where.push("p.type = @type");
    params.type = type;
  }
  if (tags.length) {
    where.push(`p.id IN (
      SELECT pt.post_id FROM post_tags pt
      JOIN tags t ON t.id = pt.tag_id
      WHERE t.name IN (${tags.map((_, i) => `@tag${i}`).join(",")})
      GROUP BY pt.post_id
      HAVING COUNT(DISTINCT t.name) = ${tags.length}
    )`);
    tags.forEach((t, i) => (params[`tag${i}`] = t));
  }

  const sql = `
    SELECT p.* FROM posts p
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT @limit OFFSET @offset
  `;
  const rows = getDb().prepare(sql).all(params) as PostRow[];
  return rows.map(attachTags);
}

export function getPost(id: number): Post | null {
  const row = getDb().prepare("SELECT * FROM posts WHERE id = ?").get(id) as
    | PostRow
    | undefined;
  return row ? attachTags(row) : null;
}

export interface DoujinPage {
  page_no: number;
  file: string;
}

export function getDoujinPages(id: number): DoujinPage[] {
  return getDb()
    .prepare(
      "SELECT page_no, file FROM doujin_pages WHERE post_id = ? ORDER BY page_no"
    )
    .all(id) as DoujinPage[];
}

export function popularTags(limit = 40): { name: string; count: number }[] {
  return getDb()
    .prepare(
      `SELECT t.name, COUNT(pt.post_id) AS count
       FROM tags t JOIN post_tags pt ON pt.tag_id = t.id
       GROUP BY t.id ORDER BY count DESC, t.name LIMIT ?`
    )
    .all(limit) as { name: string; count: number }[];
}

export function countPosts(opts: ListOpts = {}): number {
  const { type = null, tags = [] } = opts;
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (type) {
    where.push("p.type = @type");
    params.type = type;
  }
  if (tags.length) {
    where.push(`p.id IN (
      SELECT pt.post_id FROM post_tags pt
      JOIN tags t ON t.id = pt.tag_id
      WHERE t.name IN (${tags.map((_, i) => `@tag${i}`).join(",")})
      GROUP BY pt.post_id
      HAVING COUNT(DISTINCT t.name) = ${tags.length}
    )`);
    tags.forEach((t, i) => (params[`tag${i}`] = t));
  }
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM posts p ${
        where.length ? "WHERE " + where.join(" AND ") : ""
      }`
    )
    .get(params) as { n: number };
  return row.n;
}

function linkTags(db: Database.Database, postId: number, tags: string[]) {
  const insertTag = db.prepare(
    "INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING"
  );
  const getTag = db.prepare("SELECT id FROM tags WHERE name = ?");
  const link = db.prepare(
    "INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)"
  );
  for (const raw of tags) {
    const name = raw.trim().toLowerCase();
    if (!name) continue;
    insertTag.run(name);
    const tag = getTag.get(name) as { id: number };
    link.run(postId, tag.id);
  }
}

function pruneOrphanTags(db: Database.Database) {
  db.prepare(
    "DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM post_tags)"
  ).run();
}

export interface CreatePostInput {
  type: PostType;
  title: string;
  ext?: string;
  page_count?: number;
  width?: number | null;
  height?: number | null;
  size?: number;
  tags: string[];
  pages?: { page_no: number; file: string }[];
}

export function createPost(input: CreatePostInput): number {
  const db = getDb();
  return db.transaction((): number => {
    const info = db
      .prepare(
        `INSERT INTO posts (type, title, ext, page_count, width, height, size, created_at)
         VALUES (@type, @title, @ext, @page_count, @width, @height, @size, @created_at)`
      )
      .run({
        type: input.type,
        title: input.title,
        ext: input.ext ?? "",
        page_count: input.page_count ?? 0,
        width: input.width ?? null,
        height: input.height ?? null,
        size: input.size ?? 0,
        created_at: Date.now(),
      });
    const postId = Number(info.lastInsertRowid);
    linkTags(db, postId, input.tags);
    if (input.pages?.length) {
      const insertPage = db.prepare(
        "INSERT INTO doujin_pages (post_id, page_no, file) VALUES (?, ?, ?)"
      );
      for (const pg of input.pages) insertPage.run(postId, pg.page_no, pg.file);
    }
    return postId;
  })();
}

export function updatePost(id: number, title: string, tags: string[]): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare("UPDATE posts SET title = ? WHERE id = ?").run(title, id);
    db.prepare("DELETE FROM post_tags WHERE post_id = ?").run(id);
    linkTags(db, id, tags);
    pruneOrphanTags(db);
  })();
}

export function finalizeDoujin(
  id: number,
  pages: { page_no: number; file: string }[],
  width: number | null,
  height: number | null
): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare(
      "UPDATE posts SET page_count = ?, width = ?, height = ? WHERE id = ?"
    ).run(pages.length, width, height, id);
    const ins = db.prepare(
      "INSERT INTO doujin_pages (post_id, page_no, file) VALUES (?, ?, ?)"
    );
    for (const pg of pages) ins.run(id, pg.page_no, pg.file);
  })();
}

export function deletePost(id: number): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare("DELETE FROM posts WHERE id = ?").run(id);
    pruneOrphanTags(db);
  })();
}
