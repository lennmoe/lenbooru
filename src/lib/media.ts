import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import AdmZip from "adm-zip";
import UPNG from "upng-js";
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
/** Longest side of the "sample" shown on the post page instead of a heavy original. */
export const SAMPLE_MAX = 1280;

/** Big files get a lighter sample for the post page, like Danbooru's "resized to X%". */
export function needsSample(width: number | null, height: number | null, bytes: number): boolean {
  return bytes > 5 * 1024 * 1024 || Math.max(width ?? 0, height ?? 0) > 2000;
}

/** Share of the original the sample is displayed at (for "Resized to X%"). */
export function samplePercent(width: number | null, height: number | null): number {
  const longest = Math.max(width ?? 0, height ?? 0);
  return longest > SAMPLE_MAX ? Math.round((SAMPLE_MAX / longest) * 100) : 100;
}

export function samplePath(postId: number): string {
  return path.join(DIRS.sample, `${postId}.webp`);
}

export function hasSample(postId: number): boolean {
  return fs.existsSync(samplePath(postId));
}

/** Animated PNG: an "acTL" chunk before the first image data. */
function isApng(buf: Buffer): boolean {
  if (buf.length < 16 || buf.readUInt32BE(0) !== 0x89504e47) return false;
  const actl = buf.indexOf("acTL");
  const idat = buf.indexOf("IDAT");
  return actl > 0 && (idat < 0 || actl < idat);
}

/**
 * Resize any image to a WebP that fits in max×max, keeping every frame when the
 * source is animated (GIF, animated WebP, and APNG — which libvips can't decode,
 * so its frames are decoded with UPNG and joined back). No pixel limit: long
 * 1080p GIFs easily exceed sharp's default.
 */
export async function toWebp(input: Buffer, max: number, quality: number, out: string): Promise<void> {
  const resize = { fit: "inside" as const, withoutEnlargement: true };
  if (isApng(input)) {
    const img = UPNG.decode(Uint8Array.prototype.slice.call(input).buffer);
    const frames = UPNG.toRGBA8(img); // full-canvas frames, dispose/blend already applied
    if (frames.length > 1) {
      const small = await Promise.all(
        frames.map((f) =>
          sharp(Buffer.from(f), { raw: { width: img.width, height: img.height, channels: 4 } })
            .resize(max, max, resize)
            .png()
            .toBuffer()
        )
      );
      await sharp(small, { join: { animated: true } })
        .webp({ quality, effort: 3, loop: 0, delay: img.frames.map((f) => f.delay || 100) })
        .toFile(out);
      return;
    }
  }
  const opts = { failOn: "none" as const, limitInputPixels: false as const };
  const { pages = 1 } = await sharp(input, { ...opts, animated: true }).metadata();
  await sharp(input, { ...opts, animated: pages > 1 })
    .rotate()
    .resize(max, max, resize)
    .webp({ quality, effort: 3 })
    .toFile(out);
}

/**
 * Build a webp thumbnail from an image buffer. Animated sources keep every frame
 * so they move in the gallery. Returns false on failure.
 */
export async function makeThumb(input: Buffer, postId: number): Promise<boolean> {
  try {
    await toWebp(input, THUMB_MAX, 75, path.join(DIRS.thumb, `${postId}.webp`));
    return true;
  } catch (e) {
    console.error("thumb failed", e);
    return false;
  }
}

/** Lighter version of a big image for the post page (animated if the original is). */
export async function makeSample(input: Buffer, postId: number): Promise<boolean> {
  try {
    await toWebp(input, SAMPLE_MAX, 80, samplePath(postId));
    return true;
  } catch (e) {
    console.error("sample failed", e);
    return false;
  }
}

export async function imageDimensions(
  input: Buffer
): Promise<{ width: number | null; height: number | null }> {
  try {
    const meta = await sharp(input, { failOn: "none", limitInputPixels: false }).metadata();
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
  rm(samplePath(post.id));
  if (post.type === "image" || post.type === "gif") rm(path.join(DIRS.image, `${post.id}.${post.ext}`));
  if (post.type === "video") rm(path.join(DIRS.video, `${post.id}.${post.ext}`));
  if (post.type === "doujin") rm(path.join(DIRS.doujin, String(post.id)));
}

/** Delete every stored media file (images, gifs, videos, doujin pages, thumbnails). */
export async function wipeMedia(): Promise<void> {
  for (const dir of [DIRS.image, DIRS.video, DIRS.doujin, DIRS.thumb, DIRS.sample]) {
    await fsp.rm(dir, { recursive: true, force: true });
  }
  ensureDirs();
}
