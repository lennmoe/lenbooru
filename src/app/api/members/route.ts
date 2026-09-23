import { NextRequest, NextResponse } from "next/server";
import { getT } from "@/lib/i18n/server";
import { auth } from "@/auth";
import { canManageUsers, ROLES, Role } from "@/lib/perms";
import { listUsers, setUser, removeUser } from "@/lib/users";

export const runtime = "nodejs";

async function ownerOnly() {
  const session = await auth();
  return canManageUsers(session?.user?.role);
}

export async function GET() {
  if (!(await ownerOnly())) {
    return NextResponse.json({ error: (await getT()).api.forbidden }, { status: 403 });
  }
  return NextResponse.json({ users: listUsers() });
}

export async function POST(req: NextRequest) {
  if (!(await ownerOnly())) {
    return NextResponse.json({ error: (await getT()).api.forbidden }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const discordId = String(body.discordId ?? "").trim();
  const role = String(body.role ?? "") as Role;
  const username = String(body.username ?? "").trim();

  if (!/^\d{5,25}$/.test(discordId)) {
    return NextResponse.json({ error: (await getT()).api.badDiscordId }, { status: 400 });
  }
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: (await getT()).api.badRole }, { status: 400 });
  }
  setUser(discordId, role, username);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await ownerOnly())) {
    return NextResponse.json({ error: (await getT()).api.forbidden }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const ok = removeUser(id);
  return NextResponse.json({ ok });
}
