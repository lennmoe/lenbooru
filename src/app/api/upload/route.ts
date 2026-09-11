import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { auth } from "@/auth";
import { canUpload } from "@/lib/perms";
import { createPost, deletePost, finalizeDoujin } from "@/lib/db";
import { DIRS } from "@/lib/paths";
import {
  IMAGE_EXTS,
  VIDEO_EXTS,
  makeThumb,
  imageDimensions,
  extractDoujin,
  saveBuffer,
} from "@/lib/media";

export const runtime = "nodejs";
export const maxDuration = 300;

function parseTags(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(/[\s,]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!canUpload(session?.user?.role)) {
      return NextResponse.json(
        { error: "Tu n'as pas la permission d'uploader" },
        { status: 403 }
      );
    }

    const form = await req.formData();
    const type = String(form.get("type") || "");
    const title = String(form.get("title") || "").trim();
    const tags = parseTags(form.get("tags"));
    const file = form.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const origExt = path.extname(file.name).toLowerCase().replace(".", "");

    if (type === "image") {
      if (!IMAGE_EXTS.has("." + origExt)) {
        return NextResponse.json(
          { error: `Format image non supporté: .${origExt}` },
          { status: 400 }
        );
      }
      const { width, height } = await imageDimensions(buffer);
      const id = createPost({
        type: "image",
        title: title || file.name,
        ext: origExt,
        width,
        height,
        size: file.size,
        tags,
      });
      await saveBuffer(DIRS.image, `${id}.${origExt}`, buffer);
      await makeThumb(buffer, id);
      return NextResponse.json({ id });
    }

    if (type === "video") {
      if (!VIDEO_EXTS.has("." + origExt)) {
        return NextResponse.json(
          { error: `Format vidéo non supporté: .${origExt}` },
          { status: 400 }
        );
      }
      const id = createPost({
        type: "video",
        title: title || file.name,
        ext: origExt,
        size: file.size,
        tags,
      });
      await saveBuffer(DIRS.video, `${id}.${origExt}`, buffer);
      return NextResponse.json({ id });
    }

    if (type === "doujin") {
      if (origExt !== "zip" && origExt !== "cbz") {
        return NextResponse.json(
          { error: "Le doujin doit être un .zip (ou .cbz)" },
          { status: 400 }
        );
      }
      // create the post first so we have an id for the folder
      const id = createPost({
        type: "doujin",
        title: title || file.name.replace(/\.(zip|cbz)$/i, ""),
        size: file.size,
        tags,
        page_count: 0,
      });
      let extracted;
      try {
        extracted = await extractDoujin(buffer, id);
      } catch (e) {
        // roll back the empty post
        deletePost(id);
        return NextResponse.json(
          { error: (e as Error).message },
          { status: 400 }
        );
      }
      const dims = await imageDimensions(extracted.coverBuffer);
      await makeThumb(extracted.coverBuffer, id);
      finalizeDoujin(id, extracted.pages, dims.width, dims.height);

      return NextResponse.json({ id, pages: extracted.pages.length });
    }

    return NextResponse.json({ error: "Type inconnu" }, { status: 400 });
  } catch (e) {
    console.error("upload error", e);
    return NextResponse.json(
      { error: (e as Error).message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
