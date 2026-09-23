import path from "node:path";
import { getDoujinPages, getPost } from "@/lib/db";
import { DIRS } from "@/lib/paths";
import { serveFile } from "@/lib/serveFile";
import { parseShareSlug, verifyShare } from "@/lib/share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public signed share link (see lib/share.ts). Serves the raw file itself, so
 * Discord shows the image / GIF / video directly under the message, no embed card.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const parsed = parseShareSlug((await params).slug);
  if (!parsed || !verifyShare(parsed.id, parsed.sig)) {
    return new Response("Not found", { status: 404 });
  }
  const post = getPost(parsed.id);
  if (!post) return new Response("Not found", { status: 404 });

  let abs: string;
  if (post.type === "doujin") {
    const cover = getDoujinPages(post.id)[0];
    if (!cover) return new Response("Not found", { status: 404 });
    abs = path.join(DIRS.doujin, String(post.id), cover.file);
  } else {
    abs = path.join(post.type === "video" ? DIRS.video : DIRS.image, `${post.id}.${post.ext}`);
  }

  return serveFile(req, abs, "public, max-age=86400");
}
