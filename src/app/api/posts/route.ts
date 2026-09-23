import { NextRequest, NextResponse } from "next/server";
import { parseSearch } from "@/lib/tags";
import { getT } from "@/lib/i18n/server";
import { auth } from "@/auth";
import { canRead } from "@/lib/perms";
import { listPosts, POST_TYPES, PostType } from "@/lib/db";

export const runtime = "nodejs";

const TYPES = POST_TYPES;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!canRead(session?.user?.role)) {
    return NextResponse.json({ error: (await getT()).api.unauthorized }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const typeParam = sp.get("type");
  const type = TYPES.includes(typeParam as PostType)
    ? (typeParam as PostType)
    : null;
  const { tags, rating } = parseSearch(sp.get("tags") || "");
  const offset = Math.max(0, parseInt(sp.get("offset") || "0", 10) || 0);
  const limit = Math.min(120, Math.max(1, parseInt(sp.get("limit") || "60", 10)));

  const posts = listPosts({ type, tags, rating, offset, limit });
  return NextResponse.json({
    posts,
    nextOffset: offset + posts.length,
    done: posts.length < limit,
  });
}
