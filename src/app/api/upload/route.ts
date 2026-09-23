import { NextRequest, NextResponse } from "next/server";
import fsp from "node:fs/promises";
import path from "node:path";
import { auth } from "@/auth";
import { canUpload } from "@/lib/perms";
import { getT } from "@/lib/i18n/server";
import { createPost, deletePost, finalizeDoujin } from "@/lib/db";
import { DIRS } from "@/lib/paths";
import { assemble, discardUpload, isUploadId, moveFile } from "@/lib/chunks";
import { cleanSource, isRating } from "@/lib/tags";
import {
  IMAGE_EXTS,
  VIDEO_EXTS,
  makeThumb,
  makeSample,
  needsSample,
  imageDimensions,
  extractDoujin,
} from "@/lib/media";

export const runtime = "nodejs";
export const maxDuration = 300;

function parseTags(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(/[\s,]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * POST /api/upload — finalize a chunked upload (pieces already sent to
 * /api/upload/chunk): JSON { uploadId, chunks, name, type, title, tags }.
 * The file is assembled on disk, then moved into the media folders.
 */
export async function POST(req: NextRequest) {
  const t = await getT();
  const session = await auth();
  if (!canUpload(session?.user?.role)) {
    return NextResponse.json({ error: t.api.noUploadPerm }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const uploadId = String(body.uploadId ?? "");
  const chunks = Number(body.chunks);
  const name = String(body.name ?? "");
  const type = String(body.type ?? "");
  const title = String(body.title ?? "").trim();
  const tags = parseTags(body.tags);
  const uploader = session?.user?.name ?? "";
  const source = cleanSource(body.source);
  const rating = isRating(body.rating) ? body.rating : "";

  if (!isUploadId(uploadId) || !Number.isInteger(chunks) || chunks < 1 || !name) {
    return NextResponse.json({ error: t.api.missingFile }, { status: 400 });
  }

  const origExt = path.extname(name).toLowerCase().replace(".", "");
  const bad = (error: string) => {
    void discardUpload(uploadId);
    return NextResponse.json({ error }, { status: 400 });
  };

  if (!["image", "gif", "video", "doujin"].includes(type)) return bad(t.api.unknownType);
  if (type === "gif" && origExt !== "gif") return bad(t.api.mustBeGif);
  if ((type === "image" || type === "gif") && !IMAGE_EXTS.has("." + origExt)) {
    return bad(t.api.badImage(origExt));
  }
  if (type === "video" && !VIDEO_EXTS.has("." + origExt)) return bad(t.api.badVideo(origExt));
  if (type === "doujin" && origExt !== "zip" && origExt !== "cbz") return bad(t.api.mustBeZip);

  let file: string;
  let size: number;
  try {
    ({ file, size } = await assemble(uploadId, chunks));
  } catch (e) {
    return bad((e as Error).message === "MISSING_CHUNK" ? t.api.missingChunk : t.api.serverError);
  }
  if (size === 0) return bad(t.api.missingFile);

  try {
    if (type === "image" || type === "gif") {
      // a .gif dropped in the Image tab still lands in the GIF category
      const isGif = origExt === "gif";
      const buffer = await fsp.readFile(file);
      const { width, height } = await imageDimensions(buffer);
      const id = createPost({
        type: isGif ? "gif" : "image",
        title: title || name,
        ext: origExt,
        width,
        height,
        size,
        tags,
        uploader,
        source,
        rating,
      });
      await moveFile(file, path.join(DIRS.image, `${id}.${origExt}`));
      await makeThumb(buffer, id);
      if (needsSample(width, height, size)) await makeSample(buffer, id);
      return NextResponse.json({ id });
    }

    if (type === "video") {
      const id = createPost({
        type: "video",
        title: title || name,
        ext: origExt,
        size,
        tags,
        uploader,
        source,
        rating,
      });
      await moveFile(file, path.join(DIRS.video, `${id}.${origExt}`));
      return NextResponse.json({ id });
    }

    // doujin: create the post first so we have an id for the folder
    const id = createPost({
      type: "doujin",
      title: title || name.replace(/\.(zip|cbz)$/i, ""),
      size,
      tags,
      uploader,
      source,
      rating,
      page_count: 0,
    });
    let extracted;
    try {
      extracted = await extractDoujin(file, id);
    } catch (e) {
      deletePost(id); // roll back the empty post
      return NextResponse.json(
        { error: (e as Error).message === "NO_IMAGES" ? t.api.zipNoImages : t.api.zipInvalid },
        { status: 400 }
      );
    }
    const dims = await imageDimensions(extracted.coverBuffer);
    await makeThumb(extracted.coverBuffer, id);
    finalizeDoujin(id, extracted.pages, dims.width, dims.height);
    return NextResponse.json({ id, pages: extracted.pages.length });
  } catch (e) {
    console.error("upload error", e);
    return NextResponse.json({ error: t.api.serverError }, { status: 500 });
  } finally {
    await discardUpload(uploadId);
  }
}
