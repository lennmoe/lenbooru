import { NextRequest, NextResponse } from "next/server";
import { chatMember } from "@/lib/chatAuth";
import { chunkTooLarge, isUploadId, writeChunk } from "@/lib/chunks";
import { ChatUploadError, cleanupOrphanUploads, finalizeChatUpload } from "@/lib/chatFiles";
import { CHAT_MAX_BYTES, CHUNK_SIZE } from "@/lib/uploadLimits";
import { getT } from "@/lib/i18n/server";

export const runtime = "nodejs";
export const maxDuration = 300;

/** A 250 MB file is at most this many 50 MB pieces. */
const MAX_CHUNKS = Math.ceil(CHAT_MAX_BYTES / CHUNK_SIZE);

/** PUT ?id=<uploadId>&index=<n> — one piece of a chat attachment (any member). */
export async function PUT(req: NextRequest) {
  const t = await getT();
  if (!(await chatMember())) return NextResponse.json({ error: t.api.unauthorized }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const index = Number(req.nextUrl.searchParams.get("index"));
  if (!isUploadId(id) || !Number.isInteger(index) || index < 0 || !req.body) {
    return NextResponse.json({ error: t.api.missingFile }, { status: 400 });
  }
  if (index >= MAX_CHUNKS) return NextResponse.json({ error: t.api.chatTooLarge }, { status: 413 });
  if (chunkTooLarge(req.headers.get("content-length"))) {
    return NextResponse.json({ error: t.api.chunkTooLarge }, { status: 413 });
  }
  try {
    await writeChunk(id, index, req.body);
  } catch (e) {
    const tooLarge = (e as Error).message === "CHUNK_TOO_LARGE";
    return NextResponse.json({ error: tooLarge ? t.api.chunkTooLarge : t.api.serverError }, { status: tooLarge ? 413 : 500 });
  }
  return NextResponse.json({ ok: true });
}

/** POST { uploadId, chunks, name } — assemble and store; returns the attachment to send with a message. */
export async function POST(req: NextRequest) {
  const t = await getT();
  const me = await chatMember();
  if (!me) return NextResponse.json({ error: t.api.unauthorized }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const uploadId = String(body.uploadId ?? "");
  const chunks = Number(body.chunks);
  const name = String(body.name ?? "");
  if (!isUploadId(uploadId) || !Number.isInteger(chunks) || chunks < 1 || chunks > MAX_CHUNKS || !name) {
    return NextResponse.json({ error: t.api.missingFile }, { status: 400 });
  }
  cleanupOrphanUploads();
  try {
    const attachment = await finalizeChatUpload(uploadId, chunks, name, me.user.id);
    return NextResponse.json({ attachment });
  } catch (e) {
    if (e instanceof ChatUploadError) {
      const map = { TOO_LARGE: [t.api.chatTooLarge, 413], BAD_TYPE: [t.api.chatBadType, 400], MISSING: [t.api.missingChunk, 400] } as const;
      const [error, status] = map[e.code];
      return NextResponse.json({ error }, { status });
    }
    console.error("chat upload error", e);
    return NextResponse.json({ error: t.api.serverError }, { status: 500 });
  }
}
