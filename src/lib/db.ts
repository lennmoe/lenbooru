import Database from "better-sqlite3";
import path from "node:path";
import { DATA_DIR, ensureDirs } from "./paths";
import { parseTag, type Rating, type TagCategory } from "./tags";

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

CREATE TABLE IF NOT EXISTS chat_channels (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id    INTEGER NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  author_id     TEXT NOT NULL,
  author_name   TEXT NOT NULL DEFAULT '',
  author_avatar TEXT NOT NULL DEFAULT '',
  content       TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  edited_at     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages(channel_id, id);

-- chat attachments: uploaded first (message_id NULL), then attached when the message is sent
CREATE TABLE IF NOT EXISTS chat_uploads (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  file       TEXT UNIQUE NOT NULL,
  preview    TEXT,
  owner_id   TEXT NOT NULL,
  kind       TEXT NOT NULL,
  name       TEXT NOT NULL DEFAULT '',
  size       INTEGER NOT NULL DEFAULT 0,
  width      INTEGER,
  height     INTEGER,
  message_id INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_uploads_message ON chat_uploads(message_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(type);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag_id);

-- GIFs uploaded before the dedicated "gif" type existed
UPDATE posts SET type = 'gif' WHERE type = 'image' AND ext = 'gif';
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
  migrate(db);
  _db = db;
  return _db;
}

/** Additive column migrations for databases created by older versions. */
function migrate(db: Database.Database) {
  const cols = (db.prepare("PRAGMA table_info(posts)").all() as { name: string }[]).map(
    (c) => c.name
  );
  if (!cols.includes("uploader")) {
    db.exec("ALTER TABLE posts ADD COLUMN uploader TEXT NOT NULL DEFAULT ''");
  }
  if (!cols.includes("source")) {
    db.exec("ALTER TABLE posts ADD COLUMN source TEXT NOT NULL DEFAULT ''");
  }
  if (!cols.includes("rating")) {
    // g | s | q | e (Danbooru ratings), '' = not rated
    db.exec("ALTER TABLE posts ADD COLUMN rating TEXT NOT NULL DEFAULT ''");
  }
  const tagCols = (db.prepare("PRAGMA table_info(tags)").all() as { name: string }[]).map(
    (c) => c.name
  );
  if (!tagCols.includes("category")) {
    // artist | copyright | character | general (see lib/tags.ts)
    db.exec("ALTER TABLE tags ADD COLUMN category TEXT NOT NULL DEFAULT 'general'");
  }
}

export type PostType = "image" | "gif" | "video" | "doujin";

export const POST_TYPES: PostType[] = ["image", "gif", "video", "doujin"];

export interface PostRow {
  id: number;
  type: PostType;
  title: string;
  ext: string;
  page_count: number;
  width: number | null;
  height: number | null;
  size: number;
  uploader: string;
  source: string;
  rating: Rating | "";
  created_at: number;
}

export interface Post extends PostRow {
  tags: string[];
}

const PAGE_SIZE = 60;

interface ListOpts {
  type?: PostType | null;
  tags?: string[];
  rating?: Rating | null;
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
  const { type = null, tags = [], rating = null, offset = 0, limit = PAGE_SIZE } = opts;
  const where: string[] = [];
  const params: Record<string, unknown> = { offset, limit };

  if (type) {
    where.push("p.type = @type");
    params.type = type;
  }
  if (rating) {
    where.push("p.rating = @rating");
    params.rating = rating;
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

/** Neighbours in gallery order (newest first): `newer` = previous, `older` = next. */
export function adjacentPosts(post: PostRow): { newer: number | null; older: number | null } {
  const db = getDb();
  const p = { c: post.created_at, id: post.id };
  const newer = db
    .prepare(
      `SELECT id FROM posts WHERE created_at > @c OR (created_at = @c AND id > @id)
       ORDER BY created_at ASC, id ASC LIMIT 1`
    )
    .get(p) as { id: number } | undefined;
  const older = db
    .prepare(
      `SELECT id FROM posts WHERE created_at < @c OR (created_at = @c AND id < @id)
       ORDER BY created_at DESC, id DESC LIMIT 1`
    )
    .get(p) as { id: number } | undefined;
  return { newer: newer?.id ?? null, older: older?.id ?? null };
}

export interface TagInfo {
  name: string;
  category: TagCategory;
  count: number;
}

/** A post's tags with their category and the number of posts using each one. */
export function postTagCounts(id: number): TagInfo[] {
  return getDb()
    .prepare(
      `SELECT t.name, t.category, (SELECT COUNT(*) FROM post_tags x WHERE x.tag_id = t.id) AS count
       FROM tags t JOIN post_tags pt ON pt.tag_id = t.id
       WHERE pt.post_id = ? ORDER BY t.name`
    )
    .all(id) as TagInfo[];
}

/**
 * Autocomplete: tags starting with `q`, or with a word of it (after "_"),
 * exact match first, then most used. Optionally limited to one category.
 */
export function searchTags(q: string, limit = 10, category: TagCategory | null = null): TagInfo[] {
  // "!" escapes LIKE wildcards, so "_" and "%" typed by the user match literally
  const esc = q.replace(/[!%_]/g, (c) => "!" + c);
  return getDb()
    .prepare(
      `SELECT t.name, t.category, COUNT(pt.post_id) AS count
       FROM tags t JOIN post_tags pt ON pt.tag_id = t.id
       WHERE (t.name LIKE @start ESCAPE '!' OR t.name LIKE @word ESCAPE '!')
         AND (@category IS NULL OR t.category = @category)
       GROUP BY t.id
       ORDER BY (t.name = @q) DESC, (t.name LIKE @start ESCAPE '!') DESC, count DESC, t.name
       LIMIT @limit`
    )
    .all({ q, start: `${esc}%`, word: `%!_${esc}%`, limit, category }) as TagInfo[];
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

export function popularTags(limit = 40): TagInfo[] {
  return getDb()
    .prepare(
      `SELECT t.name, t.category, COUNT(pt.post_id) AS count
       FROM tags t JOIN post_tags pt ON pt.tag_id = t.id
       GROUP BY t.id ORDER BY count DESC, t.name LIMIT ?`
    )
    .all(limit) as TagInfo[];
}

export function countPosts(opts: ListOpts = {}): number {
  const { type = null, tags = [], rating = null } = opts;
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (type) {
    where.push("p.type = @type");
    params.type = type;
  }
  if (rating) {
    where.push("p.rating = @rating");
    params.rating = rating;
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

/**
 * Attach tags to a post. A category prefix ("parody:naruto") sets the tag's
 * category; without one, an existing tag keeps its category and a new one is general.
 */
export function linkTags(db: Database.Database, postId: number, tags: string[]) {
  const insertTag = db.prepare(
    "INSERT INTO tags (name, category) VALUES (?, ?) ON CONFLICT(name) DO NOTHING"
  );
  const setCategory = db.prepare("UPDATE tags SET category = ? WHERE name = ?");
  const getTag = db.prepare("SELECT id FROM tags WHERE name = ?");
  const link = db.prepare(
    "INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)"
  );
  for (const raw of tags) {
    const { name, category } = parseTag(raw);
    if (!name) continue;
    insertTag.run(name, category ?? "general");
    if (category) setCategory.run(category, name);
    const tag = getTag.get(name) as { id: number };
    link.run(postId, tag.id);
  }
}

export function pruneOrphanTags(db: Database.Database) {
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
  uploader?: string;
  source?: string;
  rating?: Rating | "";
  tags: string[];
  pages?: { page_no: number; file: string }[];
}

export function createPost(input: CreatePostInput): number {
  const db = getDb();
  return db.transaction((): number => {
    const info = db
      .prepare(
        `INSERT INTO posts (type, title, ext, page_count, width, height, size, uploader, source, rating, created_at)
         VALUES (@type, @title, @ext, @page_count, @width, @height, @size, @uploader, @source, @rating, @created_at)`
      )
      .run({
        type: input.type,
        title: input.title,
        ext: input.ext ?? "",
        page_count: input.page_count ?? 0,
        width: input.width ?? null,
        height: input.height ?? null,
        size: input.size ?? 0,
        uploader: input.uploader ?? "",
        source: input.source ?? "",
        rating: input.rating ?? "",
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

export function updatePost(
  id: number,
  fields: { tags: string[]; source: string; rating: Rating | "" }
): void {
  const { tags, source, rating } = fields;
  const db = getDb();
  db.transaction(() => {
    db.prepare("UPDATE posts SET source = ?, rating = ? WHERE id = ?").run(source, rating, id);
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

/**
 * Wipe all content rows (posts, tags, doujin pages) and restart ids at 1.
 * Media files are removed separately (see `wipeMedia` in media.ts).
 */
export function resetContent(): { posts: number } {
  const db = getDb();
  return db.transaction(() => {
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM posts").get() as { n: number };
    db.prepare("DELETE FROM doujin_pages").run();
    db.prepare("DELETE FROM post_tags").run();
    db.prepare("DELETE FROM posts").run();
    db.prepare("DELETE FROM tags").run();
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('posts', 'tags')").run();
    return { posts: n };
  })();
}
