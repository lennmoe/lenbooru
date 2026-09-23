import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canRead } from "@/lib/perms";
import { getT } from "@/lib/i18n/server";
import { searchTags } from "@/lib/db";
import { isTagCategory, normalizeSearchTag } from "@/lib/tags";

export const runtime = "nodejs";

/** GET /api/tags?q=nar[&category=character] — tag autocomplete (name, category, post count). */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!canRead(session?.user?.role)) {
    return NextResponse.json({ error: (await getT()).api.unauthorized }, { status: 401 });
  }
  const q = normalizeSearchTag(req.nextUrl.searchParams.get("q") ?? "").replace(/^-/, "");
  if (!q) return NextResponse.json({ tags: [] });
  const limit = Math.min(20, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 10));
  const cat = req.nextUrl.searchParams.get("category");
  return NextResponse.json({
    tags: searchTags(q.slice(0, 100), limit, isTagCategory(cat) ? cat : null),
  });
}
