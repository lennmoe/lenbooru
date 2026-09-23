import { NextRequest, NextResponse } from "next/server";
import { chatMember } from "@/lib/chatAuth";
import { broadcast } from "@/lib/chatHub";

export const runtime = "nodejs";

/** POST { channel } — "X is typing…" for the others (the client throttles it). */
export async function POST(req: NextRequest) {
  const me = await chatMember();
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const channel = Number(body.channel);
  if (Number.isInteger(channel)) broadcast({ type: "typing", channel_id: channel, user: me.user });
  return NextResponse.json({ ok: true });
}
