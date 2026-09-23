import { NextRequest } from "next/server";
import { chatMember } from "@/lib/chatAuth";
import { onlineUsers, subscribe } from "@/lib/chatHub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/chat/stream — Server-Sent Events: every chat event (messages,
 * edits, deletes, typing, presence) is pushed here in real time.
 */
export async function GET(req: NextRequest) {
  const me = await chatMember();
  if (!me) return new Response("Unauthorized", { status: 401 });

  const enc = new TextEncoder();
  let stop = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      // never throw: enqueueing on a closed stream would be an uncaught error
      const send = (chunk: string) => {
        if (closed) return false;
        try {
          controller.enqueue(enc.encode(chunk));
          return true;
        } catch {
          closed = true;
          return false;
        }
      };
      send("retry: 3000\n\n");
      send(`data: ${JSON.stringify({ type: "presence", users: onlineUsers() })}\n\n`);
      const unsubscribe = subscribe(me.user, send);
      // comment line every 25 s so proxies (Cloudflare: 100 s idle) keep the connection
      const ping = setInterval(() => {
        if (!send(": ping\n\n")) stop();
      }, 25_000);
      stop = () => {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
        clearInterval(ping);
        unsubscribe();
      };
      req.signal.addEventListener("abort", () => stop());
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // no-transform keeps response compression from buffering the stream
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
