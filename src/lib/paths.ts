import path from "node:path";
import fs from "node:fs";

export const DATA_DIR = path.join(process.cwd(), "data");
export const MEDIA_DIR = path.join(DATA_DIR, "media");

export const DIRS = {
  data: DATA_DIR,
  media: MEDIA_DIR,
  image: path.join(MEDIA_DIR, "image"),
  video: path.join(MEDIA_DIR, "video"),
  doujin: path.join(MEDIA_DIR, "doujin"),
  thumb: path.join(MEDIA_DIR, "thumb"),
};

export function ensureDirs() {
  for (const dir of Object.values(DIRS)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Public URL (served from /public) for a stored media file. */
export function mediaUrl(...parts: string[]) {
  return "/media/" + parts.map((p) => encodeURIComponent(p)).join("/");
}
