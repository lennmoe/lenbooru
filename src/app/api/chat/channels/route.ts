import { NextRequest, NextResponse } from "next/server";
import { chatMember } from "@/lib/chatAuth";
import { createChannel, deleteChannel, listChannels } from "@/lib/chat";
import { removeChannelFiles } from "@/lib/chatFiles";
import { broadcast } from "@/lib/chatHub";
import { getT } from "@/lib/i18n/server";

export const runtime = "nodejs";

export async function GET() {
  if (!(await chatMember())) {
    return NextResponse.json({ error: (await getT()).api.unauthorized }, { status: 401 });
  }
  return NextResponse.json({ channels: listChannels() });
}

/** POST { name } — owner only. */
export async function POST(req: NextRequest) {
  const me = await chatMember();
  if (!me?.isOwner) return NextResponse.json({ error: (await getT()).api.forbidden }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const channel = createChannel(String(body.name ?? ""));
  if (!channel) return NextResponse.json({ error: (await getT()).api.badChannel }, { status: 400 });
  broadcast({ type: "channels" });
  return NextResponse.json({ channel });
}

/** DELETE ?id= — owner only; the channel's messages go with it. */
export async function DELETE(req: NextRequest) {
  const me = await chatMember();
  if (!me?.isOwner) return NextResponse.json({ error: (await getT()).api.forbidden }, { status: 403 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  // the last channel can't be removed (deleteChannel refuses), so only then drop its files
  if (listChannels().length > 1) removeChannelFiles(id);
  const ok = deleteChannel(id);
  if (ok) broadcast({ type: "channels" });
  return NextResponse.json({ ok });
}
