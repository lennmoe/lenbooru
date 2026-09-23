import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canManageUsers } from "@/lib/perms";
import { getT } from "@/lib/i18n/server";
import { deleteTag, listAllTags, renameTag, setTagCategory } from "@/lib/admin";
import { isTagCategory } from "@/lib/tags";

export const runtime = "nodejs";

async function ownerOnly() {
  const session = await auth();
  return canManageUsers(session?.user?.role);
}

/** GET ?q=&category=&sort=count|name&offset= */
export async function GET(req: NextRequest) {
  if (!(await ownerOnly())) return NextResponse.json({ error: (await getT()).api.forbidden }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const cat = sp.get("category");
  return NextResponse.json(
    listAllTags({
      q: (sp.get("q") || "").trim().toLowerCase(),
      category: isTagCategory(cat) ? cat : null,
      sort: sp.get("sort") === "name" ? "name" : "count",
      offset: Math.max(0, Number(sp.get("offset")) || 0),
      limit: 100,
    })
  );
}

/** PATCH { name, newName?, category? } — rename (merges into an existing tag) / recategorize. */
export async function PATCH(req: NextRequest) {
  const t = await getT();
  if (!(await ownerOnly())) return NextResponse.json({ error: t.api.forbidden }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "");
  let merged = false;
  let current = name;
  if (typeof body.newName === "string" && body.newName.trim() && body.newName.trim().toLowerCase() !== name) {
    const r = renameTag(name, body.newName.trim().toLowerCase());
    if (!r.ok) return NextResponse.json({ error: t.api.badTagName }, { status: 400 });
    merged = r.merged;
    current = body.newName.trim().toLowerCase().replace(/^[a-z]+:/, "");
  }
  if (isTagCategory(body.category)) setTagCategory(current, body.category);
  return NextResponse.json({ ok: true, merged });
}

/** DELETE ?name= — removes the tag from every post. */
export async function DELETE(req: NextRequest) {
  if (!(await ownerOnly())) return NextResponse.json({ error: (await getT()).api.forbidden }, { status: 403 });
  return NextResponse.json({ ok: deleteTag(req.nextUrl.searchParams.get("name") ?? "") });
}
