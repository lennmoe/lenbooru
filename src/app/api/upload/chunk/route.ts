import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canUpload } from "@/lib/perms";
import { getT } from "@/lib/i18n/server";
import { chunkTooLarge, cleanupStaleUploads, isUploadId, writeChunk } from "@/lib/chunks";

export const runtime = "nodejs";
export const maxDuration = 300;

/** PUT /api/upload/chunk?id=<uploadId>&index=<n> — raw body = one piece of the file. */
export async function PUT(req: NextRequest) {
  const t = await getT();
  const session = await auth();
  if (!canUpload(session?.user?.role)) {
    return NextResponse.json({ error: t.api.noUploadPerm }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id") ?? "";
  const index = Number(req.nextUrl.searchParams.get("index"));
  if (!isUploadId(id) || !Number.isInteger(index) || index < 0 || index > 99999 || !req.body) {
    return NextResponse.json({ error: t.api.missingFile }, { status: 400 });
  }

  if (chunkTooLarge(req.headers.get("content-length"))) {
    return NextResponse.json({ error: t.api.chunkTooLarge }, { status: 413 });
  }

  if (index === 0) void cleanupStaleUploads();

  try {
    await writeChunk(id, index, req.body);
  } catch (e) {
    const tooLarge = (e as Error).message === "CHUNK_TOO_LARGE";
    console.error("chunk error", e);
    return NextResponse.json(
      { error: tooLarge ? t.api.chunkTooLarge : t.api.serverError },
      { status: tooLarge ? 413 : 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
