import { getDb } from "./db";
import { attachmentsFor, type Attachment } from "./chatFiles";

export type { Attachment };

/** Real-time chat storage (channels + messages). Live delivery is in chatHub.ts. */

export const MAX_MESSAGE = 2000;
export const DEFAULT_CHANNEL = "general";

export interface Channel {
  id: number;
  name: string;
}

/** Emojis on a message, in the order they were first added. */
export interface Reaction {
  emoji: string;
  users: { id: string; name: string }[];
}

/** Short view of the message being answered (null when it was deleted). */
export interface ReplyPreview {
  id: number;
  author_id: string;
  author_name: string;
  author_avatar: string;
  content: string;
  files: number;
}

export interface ChatMessage {
  id: number;
  channel_id: number;
  author_id: string;
  author_name: string;
  author_avatar: string;
  content: string;
  created_at: number;
  edited_at: number | null;
  reply_to: number | null;
  reply: ReplyPreview | null;
  attachments: Attachment[];
  reactions: Reaction[];
}

export const MAX_REACTIONS = 20;
const REPLY_PREVIEW = 200;

type MessageRow = Omit<ChatMessage, "attachments" | "reactions" | "reply">;

function placeholders(ids: unknown[]) {
  return ids.map(() => "?").join(",");
}

function reactionsFor(messageIds: number[]): Map<number, Reaction[]> {
  const map = new Map<number, Reaction[]>();
  if (!messageIds.length) return map;
  const rows = getDb()
    .prepare(
      `SELECT message_id, emoji, user_id, user_name FROM chat_reactions
       WHERE message_id IN (${placeholders(messageIds)}) ORDER BY created_at, rowid`
    )
    .all(...messageIds) as { message_id: number; emoji: string; user_id: string; user_name: string }[];
  for (const r of rows) {
    const list = map.get(r.message_id) ?? [];
    map.set(r.message_id, list);
    let group = list.find((x) => x.emoji === r.emoji);
    if (!group) list.push((group = { emoji: r.emoji, users: [] }));
    group.users.push({ id: r.user_id, name: r.user_name });
  }
  return map;
}

function repliesFor(ids: number[]): Map<number, ReplyPreview> {
  const map = new Map<number, ReplyPreview>();
  if (!ids.length) return map;
  const rows = getDb()
    .prepare(
      `SELECT m.id, m.author_id, m.author_name, m.author_avatar, substr(m.content, 1, ${REPLY_PREVIEW}) AS content,
              (SELECT COUNT(*) FROM chat_uploads u WHERE u.message_id = m.id) AS files
       FROM chat_messages m WHERE m.id IN (${placeholders(ids)})`
    )
    .all(...ids) as ReplyPreview[];
  for (const r of rows) map.set(r.id, r);
  return map;
}

function enrich(rows: MessageRow[]): ChatMessage[] {
  const ids = rows.map((r) => r.id);
  const files = attachmentsFor(ids);
  const reactions = reactionsFor(ids);
  const replies = repliesFor([...new Set(rows.map((r) => r.reply_to).filter((x): x is number => x !== null))]);
  return rows.map((r) => ({
    ...r,
    reply: r.reply_to !== null ? (replies.get(r.reply_to) ?? null) : null,
    attachments: files.get(r.id) ?? [],
    reactions: reactions.get(r.id) ?? [],
  }));
}

/** "Mon Salon!" -> "mon-salon" (Discord-style channel names). */
export function channelName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function listChannels(): Channel[] {
  const db = getDb();
  const rows = db.prepare("SELECT id, name FROM chat_channels ORDER BY id").all() as Channel[];
  if (rows.length) return rows;
  db.prepare("INSERT OR IGNORE INTO chat_channels (name, created_at) VALUES (?, ?)").run(
    DEFAULT_CHANNEL,
    Date.now()
  );
  return db.prepare("SELECT id, name FROM chat_channels ORDER BY id").all() as Channel[];
}

export function createChannel(raw: string): Channel | null {
  const name = channelName(raw);
  if (!name) return null;
  const db = getDb();
  db.prepare("INSERT OR IGNORE INTO chat_channels (name, created_at) VALUES (?, ?)").run(name, Date.now());
  return db.prepare("SELECT id, name FROM chat_channels WHERE name = ?").get(name) as Channel;
}

/** Deletes a channel and its messages; the last channel can't be removed. */
export function deleteChannel(id: number): boolean {
  const db = getDb();
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM chat_channels").get() as { n: number };
  if (n <= 1) return false;
  return db.prepare("DELETE FROM chat_channels WHERE id = ?").run(id).changes > 0;
}

export function channelExists(id: number): boolean {
  return !!getDb().prepare("SELECT 1 FROM chat_channels WHERE id = ?").get(id);
}

/** Messages of a channel, oldest first, `limit` of them before message id `before`. */
export function listMessages(channelId: number, before: number | null, limit = 50): ChatMessage[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM chat_messages
       WHERE channel_id = @channelId AND (@before IS NULL OR id < @before)
       ORDER BY id DESC LIMIT @limit`
    )
    .all({ channelId, before, limit }) as MessageRow[];
  return enrich(rows.reverse());
}

export function getMessage(id: number): ChatMessage | null {
  const row = getDb().prepare("SELECT * FROM chat_messages WHERE id = ?").get(id) as MessageRow | undefined;
  return row ? enrich([row])[0] : null;
}

export function addMessage(
  m: Omit<ChatMessage, "id" | "created_at" | "edited_at" | "attachments" | "reactions" | "reply">
): ChatMessage {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO chat_messages (channel_id, author_id, author_name, author_avatar, content, reply_to, created_at)
       VALUES (@channel_id, @author_id, @author_name, @author_avatar, @content, @reply_to, @created_at)`
    )
    .run({ ...m, created_at: Date.now() });
  return getMessage(Number(info.lastInsertRowid))!;
}

export function editMessage(id: number, content: string): ChatMessage | null {
  getDb().prepare("UPDATE chat_messages SET content = ?, edited_at = ? WHERE id = ?").run(content, Date.now(), id);
  return getMessage(id);
}

export function deleteMessage(id: number): boolean {
  return getDb().prepare("DELETE FROM chat_messages WHERE id = ?").run(id).changes > 0;
}

/** Adds or removes `user`'s `emoji` on a message; returns the new reactions, or null if refused. */
export function toggleReaction(messageId: number, user: { id: string; name: string }, emoji: string): Reaction[] | null {
  const db = getDb();
  const removed = db
    .prepare("DELETE FROM chat_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?")
    .run(messageId, user.id, emoji).changes;
  if (!removed) {
    const known = db.prepare("SELECT 1 FROM chat_reactions WHERE message_id = ? AND emoji = ?").get(messageId, emoji);
    if (!known) {
      const { n } = db
        .prepare("SELECT COUNT(DISTINCT emoji) AS n FROM chat_reactions WHERE message_id = ?")
        .get(messageId) as { n: number };
      if (n >= MAX_REACTIONS) return null;
    }
    db.prepare(
      "INSERT INTO chat_reactions (message_id, user_id, user_name, emoji, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(messageId, user.id, user.name, emoji, Date.now());
  }
  return reactionsFor([messageId]).get(messageId) ?? [];
}

/** Trim and cap a message ("" when empty — fine if the message has attachments). */
export function cleanContent(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/\r\n/g, "\n").trim().slice(0, MAX_MESSAGE);
}
