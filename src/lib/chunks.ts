import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { once } from "node:events";
import { finished, pipeline } from "node:stream/promises";
import { DIRS } from "./paths";
import { CHUNK_SIZE } from "./uploadLimits";

/**
 * Chunked uploads: the browser sends a big file as numbered pieces (see
 * UploadClient), each streamed straight to disk — nothing is held in memory and
 * each request stays under proxy limits (Cloudflare Tunnel caps bodies at 100 MB).
 * The pieces are then concatenated into one file under data/tmp/<uploadId>/.
 */

/** Hard cap per piece on the server, with some slack. */
const MAX_CHUNK_BYTES = CHUNK_SIZE + 1024 * 1024;
const STALE_MS = 24 * 3600 * 1000;

export function isUploadId(id: string): boolean {
  return /^[A-Za-z0-9-]{8,64}$/.test(id);
}

function dirOf(id: string): string {
  return path.join(DIRS.tmp, id);
}

function partPath(id: string, index: number): string {
  return path.join(dirOf(id), `${String(index).padStart(5, "0")}.part`);
}

/** Stream one piece to disk. Written to a .tmp first so a half-received piece never counts. */
export async function writeChunk(
  id: string,
  index: number,
  body: ReadableStream<Uint8Array>
): Promise<void> {
  await fsp.mkdir(dirOf(id), { recursive: true });
  const final = partPath(id, index);
  const tmp = final + ".tmp";
  // Read the body by hand and never cancel it: Next keeps pushing request data
  // into this stream, and cancelling/destroying it mid-body makes Next enqueue
  // into a closed controller -> uncaught ERR_INVALID_STATE that crashes the server.
  // On overflow we just stop reading, like a route that answers without reading.
  const reader = body.getReader();
  const out = fs.createWriteStream(tmp);
  let received = 0;
  let tooLarge = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_CHUNK_BYTES) {
        tooLarge = true;
        break;
      }
      if (!out.write(value)) await once(out, "drain");
    }
    out.end();
    await finished(out);
    if (tooLarge) throw new Error("CHUNK_TOO_LARGE");
    await fsp.rename(tmp, final);
  } catch (e) {
    out.destroy();
    await fsp.rm(tmp, { force: true });
    throw e;
  } finally {
    reader.releaseLock();
  }
}

/** Largest body accepted for one piece (checked against Content-Length up front). */
export function chunkTooLarge(contentLength: string | null): boolean {
  const n = Number(contentLength);
  return Number.isFinite(n) && n > MAX_CHUNK_BYTES;
}

/** Concatenate pieces 0..count-1 into one file; returns its path and size. */
export async function assemble(
  id: string,
  count: number
): Promise<{ file: string; size: number }> {
  const out = path.join(dirOf(id), "assembled");
  for (let i = 0; i < count; i++) {
    await fsp.access(partPath(id, i)).catch(() => {
      throw new Error("MISSING_CHUNK");
    });
  }
  const ws = fs.createWriteStream(out);
  try {
    for (let i = 0; i < count; i++) {
      await pipeline(fs.createReadStream(partPath(id, i)), ws, { end: false });
      await fsp.rm(partPath(id, i), { force: true });
    }
  } finally {
    await new Promise<void>((resolve) => ws.end(resolve));
  }
  const { size } = await fsp.stat(out);
  return { file: out, size };
}

export async function discardUpload(id: string): Promise<void> {
  await fsp.rm(dirOf(id), { recursive: true, force: true });
}

/** Drop leftovers of uploads abandoned more than a day ago. */
export async function cleanupStaleUploads(): Promise<void> {
  let names: string[];
  try {
    names = await fsp.readdir(DIRS.tmp);
  } catch {
    return;
  }
  const now = Date.now();
  for (const name of names) {
    const dir = path.join(DIRS.tmp, name);
    try {
      const st = await fsp.stat(dir);
      if (now - st.mtimeMs > STALE_MS) await fsp.rm(dir, { recursive: true, force: true });
    } catch {
      /* already gone */
    }
  }
}

/** Move a file into place (rename, or copy + delete across devices). */
export async function moveFile(from: string, to: string): Promise<void> {
  await fsp.mkdir(path.dirname(to), { recursive: true });
  try {
    await fsp.rename(from, to);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EXDEV") throw e;
    await pipeline(fs.createReadStream(from), fs.createWriteStream(to));
    await fsp.rm(from, { force: true });
  }
}
