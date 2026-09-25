import { NextRequest, NextResponse } from "next/server";
import { chatMember } from "@/lib/chatAuth";
import { getMessage, toggleReaction } from "@/lib/chat";
import { broadcast } from "@/lib/chatHub";
import { isEmoji } from "@/lib/emoji";
import { getT } from "@/lib/i18n/server";

export const runtime = "nodejs";

/** POST { id, emoji } — add my reaction to a message, or remove it if already there. */
export async function POST(req: NextRequest) {
  const t = await getT();
  const me = await chatMember();
  if (!me) return NextResponse.json({ error: t.api.unauthorized }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const msg = getMessage(Number(body.id));
  if (!msg) return NextResponse.json({ error: t.api.notFound }, { status: 404 });
  if (!isEmoji(body.emoji)) return NextResponse.json({ error: t.api.badMessage }, { status: 400 });
  const reactions = toggleReaction(msg.id, me.user, body.emoji);
  if (!reactions) return NextResponse.json({ error: t.api.badMessage }, { status: 400 });
  broadcast({ type: "reactions", id: msg.id, channel_id: msg.channel_id, reactions });
  return NextResponse.json({ reactions });
}
