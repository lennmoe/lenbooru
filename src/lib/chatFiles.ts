import { randomUUID } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { getDb } from "./db";
import { DIRS } from "./paths";
import { assemble, discardUpload, moveFile } from "./chunks";
import { IMAGE_EXTS, VIDEO_EXTS, imageDimensions, toWebp } from "./media";
import { CHAT_MAX_BYTES } from "./uploadLimits";

/**
 * Chat attachments. A file is uploaded in chunks first (like posts), stored in
 * data/media/chat/ and recorded without a message; sending a message then
 * claims it. Only the uploader can attach their own files.
 */

export interface Attachment {
  id: number;
  file: string;
  preview: string | null;
  kind: "image" | "video";
  name: string;
  size: number;
  width: number | null;
  height: number | null;
}

/** Most attachments allowed on one message. */
export const MAX_ATTACHMENTS = 10;
const PREVIEW_MAX = 800;
const ORPHAN_MS = 24 * 3600 * 1000;

export class ChatUploadError extends Error {
  constructor(public code: "TOO_LARGE" | "BAD_TYPE" | "MISSING") {
    super(code);
  }
}

/** Assemble an uploaded file, check it and store it as a (not yet attached) attachment. */
export async function finalizeChatUpload(
  uploadId: string,
  chunks: number,
  originalName: string,
  ownerId: string
): Promise<Attachment> {
  const ext = path.extname(originalName).toLowerCase();
  const kind = IMAGE_EXTS.has(ext) ? "image" : VIDEO_EXTS.has(ext) ? "video" : null;
  if (!kind) {
    await discardUpload(uploadId);
    throw new ChatUploadError("BAD_TYPE");
  }
  let assembled: { file: string; size: number };
  try {
    assembled = await assemble(uploadId, chunks);
  } catch {
    await discardUpload(uploadId);
    throw new ChatUploadError("MISSING");
  }
  try {
    if (assembled.size === 0) throw new ChatUploadError("MISSING");
    if (assembled.size > CHAT_MAX_BYTES) throw new ChatUploadError("TOO_LARGE");

    const base = randomUUID();
    const file = `${base}${ext}`;
    await moveFile(assembled.file, path.join(DIRS.chat, file));

    let width: number | null = null;
    let height: number | null = null;
    let preview: string | null = null;
    if (kind === "image") {
      const buf = await fsp.readFile(path.join(DIRS.chat, file));
      ({ width, height } = await imageDimensions(buf));
      // light (animated if needed) version shown inline; the original opens on click
      try {
        await toWebp(buf, PREVIEW_MAX, 80, path.join(DIRS.chat, `${base}.preview.webp`));
        preview = `${base}.preview.webp`;
      } catch (e) {
        console.error("chat preview failed", e);
      }
    }

    const name = originalName.slice(0, 200);
    const info = getDb()
      .prepare(
        `INSERT INTO chat_uploads (file, preview, owner_id, kind, name, size, width, height, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(file, preview, ownerId, kind, name, assembled.size, width, height, Date.now());
    return { id: Number(info.lastInsertRowid), file, preview, kind, name, size: assembled.size, width, height };
  } finally {
    await discardUpload(uploadId);
  }
}

/** Claim the author's pending uploads for a message. Returns the ids actually attached. */
export function attachUploads(ids: number[], ownerId: string, messageId: number): number[] {
  const db = getDb();
  const ok: number[] = [];
  const claim = db.prepare(
    "UPDATE chat_uploads SET message_id = ? WHERE id = ? AND owner_id = ? AND message_id IS NULL"
  );
  for (const id of ids.slice(0, MAX_ATTACHMENTS)) {
    if (claim.run(messageId, id, ownerId).changes) ok.push(id);
  }
  return ok;
}

/** Attachments of several messages at once, by message id. */
export function attachmentsFor(messageIds: number[]): Map<number, Attachment[]> {
  const map = new Map<number, Attachment[]>();
  if (!messageIds.length) return map;
  const rows = getDb()
    .prepare(
      `SELECT id, file, preview, kind, name, size, width, height, message_id FROM chat_uploads
       WHERE message_id IN (${messageIds.map(() => "?").join(",")}) ORDER BY id`
    )
    .all(...messageIds) as (Attachment & { message_id: number })[];
  for (const { message_id, ...a } of rows) {
    if (!map.has(message_id)) map.set(message_id, []);
    map.get(message_id)!.push(a);
  }
  return map;
}

/** Best effort: a file that can't be removed (e.g. still open on Windows) never blocks the caller. */
function removeFiles(rows: { file: string; preview: string | null }[]) {
  for (const r of rows) {
    for (const f of [r.file, r.preview]) {
      if (!f) continue;
      try {
        fs.rmSync(path.join(DIRS.chat, f), { force: true, maxRetries: 3, retryDelay: 100 });
      } catch (e) {
        console.error("[chat] fichier non supprimé", f, (e as Error).message);
      }
    }
  }
}

/** Delete a message's attachment files and rows (call before deleting the message). */
export function removeMessageFiles(messageId: number): void {
  const db = getDb();
  removeFiles(db.prepare("SELECT file, preview FROM chat_uploads WHERE message_id = ?").all(messageId) as never);
  db.prepare("DELETE FROM chat_uploads WHERE message_id = ?").run(messageId);
}

/** Same for every message of a channel (call before deleting the channel). */
export function removeChannelFiles(channelId: number): void {
  const db = getDb();
  const where = "message_id IN (SELECT id FROM chat_messages WHERE channel_id = ?)";
  removeFiles(db.prepare(`SELECT file, preview FROM chat_uploads WHERE ${where}`).all(channelId) as never);
  db.prepare(`DELETE FROM chat_uploads WHERE ${where}`).run(channelId);
}

/** Uploads never sent in a message (tab closed, removed from the composer…) after a day. */
export function cleanupOrphanUploads(): void {
  const db = getDb();
  const cutoff = Date.now() - ORPHAN_MS;
  removeFiles(
    db.prepare("SELECT file, preview FROM chat_uploads WHERE message_id IS NULL AND created_at < ?").all(cutoff) as never
  );
  db.prepare("DELETE FROM chat_uploads WHERE message_id IS NULL AND created_at < ?").run(cutoff);
}
