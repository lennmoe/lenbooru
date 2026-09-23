import { NextRequest, NextResponse } from "next/server";
import { getT } from "@/lib/i18n/server";
import { auth } from "@/auth";
import { canManageUsers } from "@/lib/perms";
import { resetContent } from "@/lib/db";
import { wipeMedia } from "@/lib/media";
import { clearMembers } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!canManageUsers(session?.user?.role)) {
    return NextResponse.json({ error: (await getT()).api.forbidden }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  if (body.confirm !== "RESET") {
    return NextResponse.json({ error: (await getT()).api.missingConfirm }, { status: 400 });
  }

  const { posts } = resetContent();
  await wipeMedia();
  const members = body.members === true ? clearMembers() : 0;

  return NextResponse.json({ ok: true, posts, members });
}
