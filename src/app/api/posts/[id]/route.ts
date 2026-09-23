import { NextRequest, NextResponse } from "next/server";
import { getT } from "@/lib/i18n/server";
import { auth } from "@/auth";
import { canDelete, canEdit, canRead } from "@/lib/perms";
import { getPost, deletePost, updatePost } from "@/lib/db";
import { removePostFiles } from "@/lib/media";
import { cleanSource, isRating, splitTags } from "@/lib/tags";

export const runtime = "nodejs";

/** GET — minimal info about a post (chat previews). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!canRead(session?.user?.role)) {
    return NextResponse.json({ error: (await getT()).api.unauthorized }, { status: 401 });
  }
  const post = getPost(parseInt((await params).id, 10));
  if (!post) return NextResponse.json({ error: (await getT()).api.notFound }, { status: 404 });
  const { id, type, rating, width, height, page_count, tags } = post;
  return NextResponse.json({ post: { id, type, rating, width, height, page_count, tags } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!canEdit(session?.user?.role)) {
    return NextResponse.json({ error: (await getT()).api.noEditPerm }, { status: 403 });
  }

  const { id } = await params;
  const postId = parseInt(id, 10);
  const post = getPost(postId);
  if (!post) {
    return NextResponse.json({ error: (await getT()).api.notFound }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  updatePost(postId, {
    tags: splitTags(String(body.tags ?? "")),
    source: cleanSource(body.source),
    rating: isRating(body.rating) ? body.rating : "",
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!canDelete(session?.user?.role)) {
    return NextResponse.json(
      { error: (await getT()).api.noDeletePerm },
      { status: 403 }
    );
  }

  const { id } = await params;
  const postId = parseInt(id, 10);
  const post = getPost(postId);
  if (!post) {
    return NextResponse.json({ error: (await getT()).api.notFound }, { status: 404 });
  }
  deletePost(postId);
  removePostFiles(post);
  return NextResponse.json({ ok: true });
}
