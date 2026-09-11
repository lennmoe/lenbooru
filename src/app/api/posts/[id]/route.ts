import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canDelete, canEdit } from "@/lib/perms";
import { getPost, deletePost, updatePost } from "@/lib/db";
import { removePostFiles } from "@/lib/media";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!canEdit(session?.user?.role)) {
    return NextResponse.json({ error: "Édition non autorisée" }, { status: 403 });
  }

  const { id } = await params;
  const postId = parseInt(id, 10);
  const post = getPost(postId);
  if (!post) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  const tags = String(body.tags ?? "")
    .split(/[\s,]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  updatePost(postId, title, tags);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!canDelete(session?.user?.role)) {
    return NextResponse.json(
      { error: "Suppression non autorisée" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const postId = parseInt(id, 10);
  const post = getPost(postId);
  if (!post) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }
  deletePost(postId);
  removePostFiles(post);
  return NextResponse.json({ ok: true });
}
