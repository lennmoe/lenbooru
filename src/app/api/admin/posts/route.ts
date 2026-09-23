import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canManageUsers } from "@/lib/perms";
import { getT } from "@/lib/i18n/server";
import { countPosts, listPosts, POST_TYPES, type PostType } from "@/lib/db";
import { bulkPosts, type BulkAction } from "@/lib/admin";
import { isRating, parseSearch, splitTags } from "@/lib/tags";

export const runtime = "nodejs";

async function ownerOnly() {
  const session = await auth();
  return canManageUsers(session?.user?.role);
}

/** GET ?q=&type=&offset=&limit= — posts for the admin table (q accepts rating:x). */
export async function GET(req: NextRequest) {
  if (!(await ownerOnly())) return NextResponse.json({ error: (await getT()).api.forbidden }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const typeParam = sp.get("type") as PostType | null;
  const type = typeParam && POST_TYPES.includes(typeParam) ? typeParam : null;
  const { tags, rating } = parseSearch(sp.get("q") || "");
  const offset = Math.max(0, Number(sp.get("offset")) || 0);
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 50));
  return NextResponse.json({
    posts: listPosts({ type, tags, rating, offset, limit }),
    total: countPosts({ type, tags, rating }),
  });
}

/** POST { ids, action, value } — bulk edit: rating | addTags | removeTags | delete. */
export async function POST(req: NextRequest) {
  const t = await getT();
  if (!(await ownerOnly())) return NextResponse.json({ error: t.api.forbidden }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.map(Number) : [];
  let op: BulkAction | null = null;
  if (body.action === "rating" && isRating(body.value)) op = { action: "rating", value: body.value };
  else if (body.action === "addTags" || body.action === "removeTags") {
    const value = splitTags(String(body.value ?? ""));
    if (value.length) op = { action: body.action, value };
  } else if (body.action === "delete") op = { action: "delete" };
  if (!op || !ids.length) return NextResponse.json({ error: t.api.badRequest }, { status: 400 });
  return NextResponse.json({ ok: true, count: bulkPosts(ids, op) });
}
