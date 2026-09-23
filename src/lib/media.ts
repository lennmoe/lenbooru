import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import AdmZip from "adm-zip";
import { DIRS, ensureDirs } from "./paths";

ensureDirs();

export const IMAGE_EXTS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".avif",
  ".bmp",
  ".jfif",
]);
export const VIDEO_EXTS = new Set([
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".mkv",
  ".avi",
]);

const THUMB_MAX = 512;

/**
 * Build a webp thumbnail from an image buffer. With `animated`, every frame is
 * kept (animated webp) so GIF thumbnails move in the gallery. Returns false on failure.
 */
export async function makeThumb(
  input: Buffer,
  postId: number,
  animated = false
): Promise<boolean> {
  try {
    await sharp(input, { failOn: "none", animated })
      .rotate()
      .resize(THUMB_MAX, THUMB_MAX, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(path.join(DIRS.thumb, `${postId}.webp`));
    return true;
  } catch (e) {
    console.error("thumb failed", e);
    return false;
  }
}

export async function imageDimensions(
  input: Buffer
): Promise<{ width: number | null; height: number | null }> {
  try {
    const meta = await sharp(input, { failOn: "none" }).metadata();
    return { width: meta.width ?? null, height: meta.height ?? null };
  } catch {
    return { width: null, height: null };
  }
}

/** Natural numeric comparison so "2.jpg" sorts before "10.jpg". */
export function naturalCompare(a: string, b: string): number {
  const na = a.match(/\d+/g);
  const nb = b.match(/\d+/g);
  if (na && nb) {
    const len = Math.min(na.length, nb.length);
    for (let i = 0; i < len; i++) {
      const d = parseInt(na[i], 10) - parseInt(nb[i], 10);
      if (d !== 0) return d;
    }
  }
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export interface ExtractedDoujin {
  pages: { page_no: number; file: string }[];
  coverBuffer: Buffer;
}

/**
 * Extract image entries from a doujin zip into public/media/doujin/<postId>/.
 * Files are re-numbered 001..NNN in natural order; entry order is preserved
 * from the archive so "the image 1 is the cover" holds.
 */
export async function extractDoujin(
  zip: Buffer | string,
  postId: number
): Promise<ExtractedDoujin> {
  // a path is read by AdmZip itself (the whole archive still goes through memory)
  const archive = new AdmZip(zip);
  const entries = archive
    .getEntries()
    .filter((e) => !e.isDirectory)
    .filter((e) => {
      const name = e.entryName;
      if (name.includes("__MACOSX") || path.basename(name).startsWith("."))
        return false;
      return IMAGE_EXTS.has(path.extname(name).toLowerCase());
    })
    .sort((a, b) => naturalCompare(a.entryName, b.entryName));

  if (!entries.length) {
    throw new Error("NO_IMAGES");
  }

  const outDir = path.join(DIRS.doujin, String(postId));
  await fsp.mkdir(outDir, { recursive: true });

  const pages: { page_no: number; file: string }[] = [];
  let coverBuffer: Buffer | null = null;
  const pad = String(entries.length).length;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const ext = path.extname(entry.entryName).toLowerCase();
    const fileName = `${String(i + 1).padStart(Math.max(pad, 3), "0")}${ext}`;
    const data = entry.getData();
    await fsp.writeFile(path.join(outDir, fileName), data);
    pages.push({ page_no: i + 1, file: fileName });
    if (i === 0) coverBuffer = data;
  }

  return { pages, coverBuffer: coverBuffer! };
}

export async function saveBuffer(
  dir: string,
  fileName: string,
  data: Buffer
): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(path.join(dir, fileName), data);
}

/** Recursively delete a post's stored files. */
export function removePostFiles(post: {
  id: number;
  type: string;
  ext: string;
}) {
  const rm = (p: string) => {
    try {
      fs.rmSync(p, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  };
  rm(path.join(DIRS.thumb, `${post.id}.webp`));
  if (post.type === "image" || post.type === "gif") rm(path.join(DIRS.image, `${post.id}.${post.ext}`));
  if (post.type === "video") rm(path.join(DIRS.video, `${post.id}.${post.ext}`));
  if (post.type === "doujin") rm(path.join(DIRS.doujin, String(post.id)));
}

/** Delete every stored media file (images, gifs, videos, doujin pages, thumbnails). */
export async function wipeMedia(): Promise<void> {
  for (const dir of [DIRS.image, DIRS.video, DIRS.doujin, DIRS.thumb]) {
    await fsp.rm(dir, { recursive: true, force: true });
  }
  ensureDirs();
}
