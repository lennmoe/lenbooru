import { open, stat, type FileHandle } from "node:fs/promises";
import path from "node:path";

export const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".jfif": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
};

const CHUNK = 256 * 1024;

/**
 * Pull-based web stream over bytes [start, end] of a file. Unlike
 * Readable.toWeb(fs.createReadStream()), it never enqueues after the client
 * aborted (video seek cancels in-flight range requests), which used to crash
 * with ERR_INVALID_STATE "Controller is already closed".
 */
function fileStream(abs: string, start: number, end: number): ReadableStream<Uint8Array> {
  let fh: FileHandle | null = null;
  let pos = start;
  let done = false;

  const release = async () => {
    done = true;
    const h = fh;
    fh = null;
    await h?.close().catch(() => {});
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (done) return;
        if (!fh) fh = await open(abs, "r");
        const remaining = end - pos + 1;
        if (remaining <= 0) {
          await release();
          controller.close();
          return;
        }
        const buf = new Uint8Array(Math.min(CHUNK, remaining));
        const { bytesRead } = await fh.read(buf, 0, buf.length, pos);
        if (done) return; // cancelled while reading
        if (bytesRead === 0) {
          await release();
          controller.close();
          return;
        }
        pos += bytesRead;
        controller.enqueue(bytesRead < buf.length ? buf.subarray(0, bytesRead) : buf);
      } catch (err) {
        const wasDone = done;
        await release();
        if (!wasDone) {
          try {
            controller.error(err);
          } catch {
            /* already closed */
          }
        }
      }
    },
    cancel() {
      return release();
    },
  });
}

/**
 * Stream a file from disk with its MIME type and HTTP Range support (video seek).
 * The caller is responsible for access control and path validation.
 */
export async function serveFile(
  req: Request,
  abs: string,
  cacheControl = "private, max-age=31536000, immutable"
): Promise<Response> {
  let info;
  try {
    info = await stat(abs);
    if (!info.isFile()) throw new Error("not a file");
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const type = MIME[path.extname(abs).toLowerCase()] || "application/octet-stream";
  const total = info.size;
  const range = req.headers.get("range");

  const baseHeaders: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": cacheControl,
    "Last-Modified": info.mtime.toUTCString(),
  };

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      let start = m[1] ? parseInt(m[1], 10) : 0;
      let end = m[2] ? parseInt(m[2], 10) : total - 1;
      if (Number.isNaN(start)) start = 0;
      if (Number.isNaN(end) || end >= total) end = total - 1;
      if (start > end || start >= total) {
        return new Response("Range Not Satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${total}` },
        });
      }
      return new Response(fileStream(abs, start, end), {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Content-Length": String(end - start + 1),
        },
      });
    }
  }

  return new Response(fileStream(abs, 0, total - 1), {
    status: 200,
    headers: { ...baseHeaders, "Content-Length": String(total) },
  });
}
