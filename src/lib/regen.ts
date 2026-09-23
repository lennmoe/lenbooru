import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { getDb, type PostRow } from "./db";
import { DIRS } from "./paths";
import { makeSample, makeThumb, needsSample } from "./media";

/**
 * Bump when thumbnail / sample generation changes, so existing posts get redone
 * once at the next server start (v2: animated APNG thumbs, no pixel limit for big
 * GIFs, samples for heavy images).
 */
const MEDIA_VERSION = 2;
const MARKER = () => path.join(DIRS.media, `.media-v${MEDIA_VERSION}`);

let running = false;

export async function regenerateMediaOnce(): Promise<void> {
  if (running || fs.existsSync(MARKER())) return;
  running = true;
  try {
    const posts = getDb()
      .prepare("SELECT * FROM posts WHERE type IN ('image', 'gif') ORDER BY id")
      .all() as PostRow[];
    let done = 0;
    for (const p of posts) {
      const file = path.join(DIRS.image, `${p.id}.${p.ext}`);
      if (!fs.existsSync(file)) continue;
      const buf = await fsp.readFile(file);
      await makeThumb(buf, p.id);
      if (needsSample(p.width, p.height, p.size)) await makeSample(buf, p.id);
      done++;
    }
    await fsp.writeFile(MARKER(), new Date().toISOString());
    if (done) console.log(`[media] miniatures / versions réduites régénérées pour ${done} post(s)`);
  } catch (e) {
    console.error("[media] régénération échouée", e);
  } finally {
    running = false;
  }
}
