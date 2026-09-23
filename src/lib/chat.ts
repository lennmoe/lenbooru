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

export interface ChatMessage {
  id: number;
  channel_id: number;
  author_id: string;
  author_name: string;
  author_avatar: string;
  content: string;
  created_at: number;
  edited_at: number | null;
  attachments: Attachment[];
}

type MessageRow = Omit<ChatMessage, "attachments">;

function withAttachments(rows: MessageRow[]): ChatMessage[] {
  const map = attachmentsFor(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, attachments: map.get(r.id) ?? [] }));
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
  return withAttachments(rows.reverse());
}

export function getMessage(id: number): ChatMessage | null {
  const row = getDb().prepare("SELECT * FROM chat_messages WHERE id = ?").get(id) as MessageRow | undefined;
  return row ? withAttachments([row])[0] : null;
}

export function addMessage(m: Omit<ChatMessage, "id" | "created_at" | "edited_at" | "attachments">): ChatMessage {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO chat_messages (channel_id, author_id, author_name, author_avatar, content, created_at)
       VALUES (@channel_id, @author_id, @author_name, @author_avatar, @content, @created_at)`
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

/** Trim and cap a message ("" when empty — fine if the message has attachments). */
export function cleanContent(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/\r\n/g, "\n").trim().slice(0, MAX_MESSAGE);
}
