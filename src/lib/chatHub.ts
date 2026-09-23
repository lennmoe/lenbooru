/**
 * In-memory fan-out for the chat: every open /api/chat/stream (Server-Sent
 * Events) is a subscriber; new / edited / deleted messages, typing and presence
 * are pushed to all of them. Lives on globalThis so dev hot-reloads and the
 * different route modules share one hub.
 */

export interface ChatUser {
  id: string;
  name: string;
  avatar: string;
}

export type ChatEvent =
  | { type: "message"; message: unknown }
  | { type: "edit"; message: unknown }
  | { type: "delete"; id: number; channel_id: number }
  | { type: "typing"; channel_id: number; user: ChatUser }
  | { type: "presence"; users: ChatUser[] }
  | { type: "channels" };

interface Subscriber {
  user: ChatUser;
  send: (chunk: string) => boolean;
}

interface Hub {
  subs: Set<Subscriber>;
}

const g = globalThis as unknown as { __lenbooruChatHub?: Hub };
const hub: Hub = (g.__lenbooruChatHub ??= { subs: new Set() });

/** Distinct connected users (someone with two tabs counts once). */
export function onlineUsers(): ChatUser[] {
  const byId = new Map<string, ChatUser>();
  for (const s of hub.subs) byId.set(s.user.id, s.user);
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function broadcast(event: ChatEvent): void {
  const chunk = `data: ${JSON.stringify(event)}\n\n`;
  for (const s of [...hub.subs]) {
    if (!s.send(chunk)) hub.subs.delete(s);
  }
}

export function subscribe(user: ChatUser, send: (chunk: string) => boolean): () => void {
  const sub: Subscriber = { user, send };
  hub.subs.add(sub);
  broadcast({ type: "presence", users: onlineUsers() });
  return () => {
    if (hub.subs.delete(sub)) broadcast({ type: "presence", users: onlineUsers() });
  };
}
