import { NextRequest, NextResponse } from "next/server";
import { chatMember } from "@/lib/chatAuth";
import {
  addMessage,
  channelExists,
  cleanContent,
  deleteMessage,
  editMessage,
  getMessage,
  listMessages,
} from "@/lib/chat";
import { broadcast } from "@/lib/chatHub";
import { attachUploads, removeMessageFiles } from "@/lib/chatFiles";
import { getT } from "@/lib/i18n/server";

export const runtime = "nodejs";

type ErrKey = "unauthorized" | "forbidden" | "badMessage" | "notFound";

async function deny(status: number, key: ErrKey) {
  return NextResponse.json({ error: (await getT()).api[key] }, { status });
}

/** GET ?channel=&before= — history, oldest first (50 per page). */
export async function GET(req: NextRequest) {
  if (!(await chatMember())) return deny(401, "unauthorized");
  const channel = Number(req.nextUrl.searchParams.get("channel"));
  const beforeRaw = req.nextUrl.searchParams.get("before");
  const before = beforeRaw ? Number(beforeRaw) : null;
  if (!channelExists(channel)) return deny(404, "notFound");
  return NextResponse.json({ messages: listMessages(channel, before, 50) });
}

/** POST { channel, content, attachments?: number[], reply_to?: number } — text, files, or both. */
export async function POST(req: NextRequest) {
  const me = await chatMember();
  if (!me) return deny(401, "unauthorized");
  const body = await req.json().catch(() => ({}));
  const channel = Number(body.channel);
  const content = cleanContent(body.content);
  const uploads: number[] = Array.isArray(body.attachments)
    ? body.attachments.map(Number).filter((n: number) => Number.isInteger(n) && n > 0)
    : [];
  if ((!content && !uploads.length) || !channelExists(channel)) return deny(400, "badMessage");
  // a reply must target a message of the same channel
  const replied = body.reply_to ? getMessage(Number(body.reply_to)) : null;
  if (body.reply_to && replied?.channel_id !== channel) return deny(400, "badMessage");
  const created = addMessage({
    channel_id: channel,
    author_id: me.user.id,
    author_name: me.user.name,
    author_avatar: me.user.avatar,
    content,
    reply_to: replied?.id ?? null,
  });
  // only the sender's own pending uploads can be attached
  const attached = uploads.length ? attachUploads(uploads, me.user.id, created.id) : [];
  if (!content && !attached.length) {
    deleteMessage(created.id); // nothing valid left to send
    return deny(400, "badMessage");
  }
  const message = attached.length ? getMessage(created.id)! : created;
  broadcast({ type: "message", message });
  return NextResponse.json({ message });
}

/** PATCH { id, content } — own messages only. */
export async function PATCH(req: NextRequest) {
  const me = await chatMember();
  if (!me) return deny(401, "unauthorized");
  const body = await req.json().catch(() => ({}));
  const msg = getMessage(Number(body.id));
  if (!msg) return deny(404, "notFound");
  if (msg.author_id !== me.user.id) return deny(403, "forbidden");
  const content = cleanContent(body.content);
  // text can only be emptied if files remain
  if (!content && !msg.attachments.length) return deny(400, "badMessage");
  const message = editMessage(msg.id, content);
  broadcast({ type: "edit", message });
  return NextResponse.json({ message });
}

/** DELETE ?id= — own messages, or any message for the owner. */
export async function DELETE(req: NextRequest) {
  const me = await chatMember();
  if (!me) return deny(401, "unauthorized");
  const msg = getMessage(Number(req.nextUrl.searchParams.get("id")));
  if (!msg) return deny(404, "notFound");
  if (msg.author_id !== me.user.id && !me.isOwner) return deny(403, "forbidden");
  removeMessageFiles(msg.id);
  deleteMessage(msg.id);
  broadcast({ type: "delete", id: msg.id, channel_id: msg.channel_id });
  return NextResponse.json({ ok: true });
}
