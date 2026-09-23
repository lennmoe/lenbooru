"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Attachment, Channel, ChatMessage } from "@/lib/chat";
import { errorText, send as sendXhr, uploadChunks } from "@/lib/clientUpload";
import { formatBytes } from "@/lib/i18n/dict";
import { CHAT_MAX_BYTES } from "@/lib/uploadLimits";
import type { ChatUser } from "@/lib/chatHub";
import type { Dict } from "@/lib/i18n/dict";
import { useT } from "./I18nProvider";

type ServerEvent =
  | { type: "message" | "edit"; message: ChatMessage }
  | { type: "delete"; id: number; channel_id: number }
  | { type: "typing"; channel_id: number; user: ChatUser }
  | { type: "presence"; users: ChatUser[] }
  | { type: "channels" };

const PAGE = 50;
/** consecutive messages from the same person within this delay are grouped */
const GROUP_MS = 7 * 60 * 1000;
const TYPING_MS = 6000;

/* ---------------------------------------------------------------- helpers */

function Avatar({ name, src, size = 40 }: { name: string; src: string; size?: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="avatar" src={src} alt="" width={size} height={size} />;
  }
  return (
    <span className="avatar avatar-fallback" style={{ width: size, height: size }}>
      {(name.trim()[0] || "?").toUpperCase()}
    </span>
  );
}

function sameDay(a: number, b: number) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function dayLabel(t: Dict, ts: number) {
  const now = Date.now();
  if (sameDay(ts, now)) return t.chat.today;
  if (sameDay(ts, now - 86_400_000)) return t.chat.yesterday;
  return new Date(ts).toLocaleDateString(t.locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function timeOf(t: Dict, ts: number) {
  return new Date(ts).toLocaleTimeString(t.locale, { hour: "2-digit", minute: "2-digit" });
}

/** "#12" and links to /post/12 on this site. */
const POST_REF = /(^|\s)#(\d{1,9})\b/g;
const URL_RE = /\bhttps?:\/\/[^\s<]+[^\s<.,:;"')\]!?]/g;

function postIdsIn(content: string): number[] {
  const ids = new Set<number>();
  for (const m of content.matchAll(POST_REF)) ids.add(Number(m[2]));
  for (const m of content.matchAll(URL_RE)) {
    // only links to a post of this very site
    try {
      const u = new URL(m[0]);
      const p = /^\/post\/(\d+)/.exec(u.pathname);
      if (p && u.host === window.location.host) ids.add(Number(p[1]));
    } catch {
      /* not a URL */
    }
  }
  return [...ids].slice(0, 3);
}

/** Message text -> React nodes: links and #post references, no HTML injection. */
function renderContent(content: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\bhttps?:\/\/[^\s<]+[^\s<.,:;"')\]!?])|((?:^|(?<=\s))#\d{1,9}\b)/g;
  let last = 0;
  let key = 0;
  for (const m of content.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push(content.slice(last, i));
    if (m[1]) {
      out.push(
        <a key={key++} href={m[1]} target="_blank" rel="noopener noreferrer nofollow">
          {m[1]}
        </a>
      );
    } else {
      const id = m[2].slice(1);
      out.push(
        <Link key={key++} href={`/post/${id}`} className="chat-postref">
          #{id}
        </Link>
      );
    }
    last = i + m[0].length;
  }
  if (last < content.length) out.push(content.slice(last));
  return out;
}

interface PostInfo {
  id: number;
  type: string;
  rating: string;
  page_count: number;
  tags: string[];
}
const postCache = new Map<number, Promise<PostInfo | null>>();
function fetchPost(id: number) {
  if (!postCache.has(id)) {
    postCache.set(
      id,
      fetch(`/api/posts/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => (d ? (d.post as PostInfo) : null))
        .catch(() => null)
    );
  }
  return postCache.get(id)!;
}

/** Small card for a post mentioned in a message (blurred by safe mode like the gallery). */
function PostPreview({ id }: { id: number }) {
  const [post, setPost] = useState<PostInfo | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    fetchPost(id).then((p) => alive && setPost(p));
    return () => {
      alive = false;
    };
  }, [id]);
  if (!post) return null;
  return (
    <Link href={`/post/${id}`} className="chat-post card" data-rating={post.rating || "none"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/media/thumb/${id}.webp`} alt={post.tags.join(" ")} loading="lazy" />
      <span className="chat-post-label">
        #{id} · {post.type}
      </span>
    </Link>
  );
}

const MEDIA_EXT = /\.(jpe?g|jfif|png|gif|webp|avif|bmp|mp4|m4v|webm|mov|mkv|avi)$/i;

function isMediaFile(f: File) {
  return f.type.startsWith("image/") || f.type.startsWith("video/") || MEDIA_EXT.test(f.name);
}

interface Pending {
  key: string;
  file: File;
  status: "uploading" | "done" | "error";
  progress: number;
  note?: string;
  error?: string;
  attachment?: Attachment;
}

/** Images / GIFs inline (light preview, original on click), videos with a player. */
function Attachments({ items }: { items: Attachment[] }) {
  return (
    <div className="chat-attachments">
      {items.map((a) => {
        const src = `/media/chat/${a.file}`;
        if (a.kind === "video") {
          return (
            <div key={a.id} className="chat-attach chat-attach-video">
              <video src={src} controls preload="metadata" playsInline />
            </div>
          );
        }
        const ratio = a.width && a.height ? a.width / a.height : 1;
        return (
          <a key={a.id} href={src} target="_blank" rel="noopener noreferrer" className="chat-attach">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.preview ? `/media/chat/${a.preview}` : src}
              alt={a.name}
              loading="lazy"
              style={{ aspectRatio: String(ratio) }}
            />
          </a>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ component */

export default function ChatApp({
  initialChannels,
  me,
  isOwner,
}: {
  initialChannels: Channel[];
  me: ChatUser;
  isOwner: boolean;
}) {
  const t = useT();
  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const [activeId, setActiveId] = useState<number>(initialChannels[0]?.id ?? 0);
  const [messages, setMessages] = useState<Record<number, ChatMessage[]>>({});
  const [hasMore, setHasMore] = useState<Record<number, boolean>>({});
  const [unread, setUnread] = useState<Record<number, number>>({});
  const [online, setOnline] = useState<ChatUser[]>([]);
  const [typing, setTyping] = useState<Record<number, Record<string, { user: ChatUser; until: number }>>>({});
  const [connected, setConnected] = useState(true);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null);
  const [newBelow, setNewBelow] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [, setTick] = useState(0);

  const scroller = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const atBottom = useRef(true);
  const activeRef = useRef(activeId);
  activeRef.current = activeId;
  const lastTypingPing = useRef(0);
  const restoreFrom = useRef<number | null>(null);

  const active = channels.find((c) => c.id === activeId);
  const list = messages[activeId];

  const scrollToBottom = useCallback(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
    setNewBelow(false);
  }, []);

  /* ---- data loading */

  const loadChannel = useCallback(async (id: number) => {
    const r = await fetch(`/api/chat/messages?channel=${id}`);
    if (!r.ok) return;
    const { messages: msgs } = (await r.json()) as { messages: ChatMessage[] };
    setMessages((m) => {
      // merge with anything that arrived live meanwhile
      const byId = new Map((m[id] ?? []).map((x) => [x.id, x]));
      for (const x of msgs) byId.set(x.id, x);
      return { ...m, [id]: [...byId.values()].sort((a, b) => a.id - b.id) };
    });
    setHasMore((h) => ({ ...h, [id]: msgs.length === PAGE }));
  }, []);

  useEffect(() => {
    if (!activeId) return;
    atBottom.current = true;
    if (!messages[activeId]) loadChannel(activeId);
    setUnread((u) => ({ ...u, [activeId]: 0 }));
    try {
      const name = channels.find((c) => c.id === activeId)?.name;
      if (name) window.history.replaceState(null, "", `/chat?c=${encodeURIComponent(name)}`);
    } catch {
      /* ignore */
    }
    composer.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // open the channel from ?c= on first load
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("c");
    const found = c && initialChannels.find((x) => x.name === c);
    if (found) setActiveId(found.id);
  }, [initialChannels]);

  async function loadOlder() {
    const current = messages[activeId];
    if (loadingOlder || !current?.length || !hasMore[activeId]) return;
    setLoadingOlder(true);
    const el = scroller.current;
    restoreFrom.current = el ? el.scrollHeight - el.scrollTop : null;
    try {
      const r = await fetch(`/api/chat/messages?channel=${activeId}&before=${current[0].id}`);
      if (!r.ok) return;
      const { messages: older } = (await r.json()) as { messages: ChatMessage[] };
      setMessages((m) => ({ ...m, [activeId]: [...older, ...(m[activeId] ?? [])] }));
      setHasMore((h) => ({ ...h, [activeId]: older.length === PAGE }));
    } finally {
      setLoadingOlder(false);
    }
  }

  // keep the viewport stable when older messages are prepended, stick to bottom otherwise
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (restoreFrom.current !== null) {
      el.scrollTop = el.scrollHeight - restoreFrom.current;
      restoreFrom.current = null;
    } else if (atBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [list]);

  /* ---- live events */

  useEffect(() => {
    const es = new EventSource("/api/chat/stream");
    let wasDown = false;
    es.onopen = () => {
      setConnected(true);
      // after a reconnection, fill the gap in the open channel
      if (wasDown) loadChannel(activeRef.current);
      wasDown = false;
    };
    es.onerror = () => {
      setConnected(false);
      wasDown = true;
    };
    es.onmessage = (e) => {
      let ev: ServerEvent;
      try {
        ev = JSON.parse(e.data);
      } catch {
        return;
      }
      if (ev.type === "presence") setOnline(ev.users);
      else if (ev.type === "channels") {
        fetch("/api/chat/channels")
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (!d) return;
            setChannels(d.channels);
            if (!d.channels.some((c: Channel) => c.id === activeRef.current)) setActiveId(d.channels[0]?.id ?? 0);
          });
      } else if (ev.type === "typing") {
        if (ev.user.id === me.id) return;
        setTyping((ty) => ({
          ...ty,
          [ev.channel_id]: { ...(ty[ev.channel_id] ?? {}), [ev.user.id]: { user: ev.user, until: Date.now() + TYPING_MS } },
        }));
      } else if (ev.type === "message") {
        const msg = ev.message;
        setMessages((m) => {
          const cur = m[msg.channel_id];
          if (!cur) return m; // not loaded yet: will come with the history
          if (cur.some((x) => x.id === msg.id)) return m;
          return { ...m, [msg.channel_id]: [...cur, msg] };
        });
        // whoever sent it isn't typing anymore
        setTyping((ty) => {
          const ch = { ...(ty[msg.channel_id] ?? {}) };
          delete ch[msg.author_id];
          return { ...ty, [msg.channel_id]: ch };
        });
        if (msg.channel_id !== activeRef.current) {
          setUnread((u) => ({ ...u, [msg.channel_id]: (u[msg.channel_id] ?? 0) + 1 }));
        } else if (!atBottom.current && msg.author_id !== me.id) {
          setNewBelow(true);
        } else if (msg.author_id === me.id) {
          atBottom.current = true;
        }
      } else if (ev.type === "edit") {
        const msg = ev.message;
        setMessages((m) =>
          m[msg.channel_id] ? { ...m, [msg.channel_id]: m[msg.channel_id].map((x) => (x.id === msg.id ? msg : x)) } : m
        );
      } else if (ev.type === "delete") {
        setMessages((m) =>
          m[ev.channel_id] ? { ...m, [ev.channel_id]: m[ev.channel_id].filter((x) => x.id !== ev.id) } : m
        );
      }
    };
    return () => es.close();
  }, [loadChannel, me.id]);

  // expire "is typing" entries
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  /* ---- actions */

  const uploading = pending.some((p) => p.status === "uploading");
  const ready = pending.filter((p) => p.status === "done" && p.attachment);
  const canSend = !uploading && (!!draft.trim() || ready.length > 0);

  async function send() {
    const content = draft.trim();
    if (!canSend || !activeId) return;
    const sent = ready.map((p) => p.key);
    setDraft("");
    atBottom.current = true;
    const r = await fetch("/api/chat/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: activeId, content, attachments: ready.map((p) => p.attachment!.id) }),
    });
    if (!r.ok) {
      setDraft(content); // give it back
      return;
    }
    setPending((ps) => ps.filter((p) => !sent.includes(p.key)));
    const { message } = (await r.json()) as { message: ChatMessage };
    setMessages((m) => {
      const cur = m[message.channel_id] ?? [];
      return cur.some((x) => x.id === message.id) ? m : { ...m, [message.channel_id]: [...cur, message] };
    });
  }

  function patchPending(key: string, patch: Partial<Pending>) {
    setPending((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  /** Validate, then upload each file in chunks; it gets attached when the message is sent. */
  function addFiles(files: File[]) {
    const items: Pending[] = files.map((file, i) => {
      const key = `${Date.now()}-${i}-${file.name}`;
      if (!isMediaFile(file)) return { key, file, status: "error", progress: 0, error: t.chat.badType(file.name) };
      if (file.size > CHAT_MAX_BYTES) return { key, file, status: "error", progress: 0, error: t.chat.tooLarge(file.name) };
      return { key, file, status: "uploading", progress: 0 };
    });
    setPending((ps) => [...ps, ...items]);
    for (const item of items) if (item.status === "uploading") uploadPending(item);
    composer.current?.focus();
  }

  async function uploadPending(item: Pending) {
    const up = await uploadChunks(
      item.file,
      (id, i) => `/api/chat/attachments?id=${id}&index=${i}`,
      t,
      (progress, note) => patchPending(item.key, { progress, note })
    );
    if ("error" in up) {
      patchPending(item.key, { status: "error", error: up.error, note: undefined });
      return;
    }
    patchPending(item.key, { progress: 99, note: t.chat.processing });
    const r = await sendXhr<{ attachment?: Attachment }>(
      "POST",
      "/api/chat/attachments",
      JSON.stringify({ ...up, name: item.file.name }),
      "application/json"
    );
    if (r.status >= 200 && r.status < 300 && r.data.attachment) {
      patchPending(item.key, { status: "done", progress: 100, note: undefined, attachment: r.data.attachment });
    } else {
      patchPending(item.key, { status: "error", error: errorText(t, r.status, r.data.error), note: undefined });
    }
  }

  function pingTyping() {
    const now = Date.now();
    if (now - lastTypingPing.current < 3000) return;
    lastTypingPing.current = now;
    fetch("/api/chat/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: activeId }),
    }).catch(() => {});
  }

  async function saveEdit() {
    if (!editing) return;
    const content = editing.text.trim();
    const { id } = editing;
    setEditing(null);
    if (!content) return;
    await fetch("/api/chat/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, content }),
    });
  }

  async function remove(id: number) {
    if (!confirm(t.chat.deleteConfirm)) return;
    await fetch(`/api/chat/messages?id=${id}`, { method: "DELETE" });
  }

  async function addChannel() {
    const name = prompt(t.chat.addChannel, t.chat.channelPlaceholder);
    if (!name) return;
    const r = await fetch("/api/chat/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (r.ok) {
      const { channel } = await r.json();
      setChannels((cs) => (cs.some((c) => c.id === channel.id) ? cs : [...cs, channel]));
      setActiveId(channel.id);
    }
  }

  async function removeChannel(c: Channel) {
    if (!confirm(t.chat.deleteChannel(c.name))) return;
    await fetch(`/api/chat/channels?id=${c.id}`, { method: "DELETE" });
  }

  function onComposerKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    } else if (e.key === "ArrowUp" && !draft) {
      // Discord-like: edit my last message
      const mine = [...(list ?? [])].reverse().find((m) => m.author_id === me.id);
      if (mine) {
        e.preventDefault();
        setEditing({ id: mine.id, text: mine.content });
      }
    }
  }

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (atBottom.current) setNewBelow(false);
    if (el.scrollTop < 80) loadOlder();
  }

  /* ---- render */

  const typers = Object.values(typing[activeId] ?? {}).filter((x) => x.until > Date.now());
  const typingText =
    typers.length === 1 ? t.chat.typingOne(typers[0].user.name) : typers.length > 1 ? t.chat.typingMany(typers.length) : "";

  return (
    <div className="chat-layout">
      <nav className="chat-channels">
        <div className="chat-side-title">
          <span>{t.chat.channels}</span>
          {isOwner && (
            <button type="button" className="chat-icon-btn" onClick={addChannel} title={t.chat.addChannel} aria-label={t.chat.addChannel}>
              +
            </button>
          )}
        </div>
        <ul>
          {channels.map((c) => (
            <li key={c.id} className={c.id === activeId ? "active" : ""}>
              <button type="button" onClick={() => setActiveId(c.id)}>
                <span className="hash">#</span>
                <span className="chat-channel-name">{c.name}</span>
                {!!unread[c.id] && c.id !== activeId && <span className="chat-unread">{unread[c.id]}</span>}
              </button>
              {isOwner && channels.length > 1 && (
                <button
                  type="button"
                  className="chat-icon-btn chat-channel-del"
                  onClick={() => removeChannel(c)}
                  title={t.chat.delete}
                  aria-label={t.chat.delete}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <section
        className={`chat-main${dragOver ? " drag" : ""}`}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) addFiles(Array.from(e.dataTransfer.files));
        }}
      >
        {dragOver && <div className="chat-drop">{t.chat.dropHere}</div>}
        <header className="chat-head">
          <span className="hash">#</span> {active?.name}
          {!connected && <span className="chat-offline">{t.chat.reconnecting}</span>}
        </header>

        <div className="chat-scroll" ref={scroller} onScroll={onScroll}>
          {list && !hasMore[activeId] && (
            <div className="chat-start">
              <strong>{active && t.chat.start(active.name)}</strong>
              {list.length === 0 && <p>{t.chat.empty}</p>}
            </div>
          )}
          {loadingOlder && <p className="chat-loading">{t.chat.loadingOlder}</p>}

          {list?.map((m, i) => {
            const prev = list[i - 1];
            const newDay = !prev || !sameDay(prev.created_at, m.created_at);
            const grouped =
              !newDay && prev && prev.author_id === m.author_id && m.created_at - prev.created_at < GROUP_MS;
            const mine = m.author_id === me.id;
            const isEditing = editing?.id === m.id;
            const refs = postIdsIn(m.content);
            return (
              <Fragment key={m.id}>
                {newDay && (
                  <div className="chat-day">
                    <span>{dayLabel(t, m.created_at)}</span>
                  </div>
                )}
                <div className={`chat-msg${grouped ? " grouped" : ""}${isEditing ? " editing" : ""}`}>
                  <div className="chat-msg-gutter">
                    {grouped ? (
                      <time className="chat-msg-hover-time">{timeOf(t, m.created_at)}</time>
                    ) : (
                      <Avatar name={m.author_name} src={m.author_avatar} />
                    )}
                  </div>
                  <div className="chat-msg-body">
                    {!grouped && (
                      <div className="chat-msg-head">
                        <strong>{m.author_name}</strong>
                        <time title={new Date(m.created_at).toLocaleString(t.locale)}>{timeOf(t, m.created_at)}</time>
                      </div>
                    )}
                    {isEditing ? (
                      <div className="chat-edit">
                        <textarea
                          autoFocus
                          value={editing.text}
                          onChange={(e) => setEditing({ id: m.id, text: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              saveEdit();
                            } else if (e.key === "Escape") {
                              setEditing(null);
                              composer.current?.focus();
                            }
                          }}
                        />
                        <small>{t.chat.editHint}</small>
                      </div>
                    ) : (
                      <div className="chat-msg-text">
                        {renderContent(m.content)}
                        {m.edited_at && <span className="chat-edited"> {t.chat.edited}</span>}
                      </div>
                    )}
                    {m.attachments.length > 0 && <Attachments items={m.attachments} />}
                    {refs.length > 0 && !isEditing && (
                      <div className="chat-posts">
                        {refs.map((id) => (
                          <PostPreview key={id} id={id} />
                        ))}
                      </div>
                    )}
                  </div>
                  {!isEditing && (mine || isOwner) && (
                    <div className="chat-msg-actions">
                      {mine && (
                        <button type="button" onClick={() => setEditing({ id: m.id, text: m.content })}>
                          {t.chat.edit}
                        </button>
                      )}
                      <button type="button" className="danger" onClick={() => remove(m.id)}>
                        {t.chat.delete}
                      </button>
                    </div>
                  )}
                </div>
              </Fragment>
            );
          })}
        </div>

        {newBelow && (
          <button type="button" className="chat-new-below" onClick={scrollToBottom}>
            {t.chat.jumpToPresent}
          </button>
        )}

        <div className="chat-typing" aria-live="polite">
          {typingText}
        </div>

        {pending.length > 0 && (
          <ul className="chat-pending">
            {pending.map((p) => (
              <li key={p.key} className={p.status}>
                <span className="chat-pending-name" title={p.file.name}>
                  {p.file.name}
                </span>
                <span className="chat-pending-meta">
                  {p.status === "error"
                    ? p.error
                    : p.status === "uploading"
                      ? `${p.progress}%${p.note ? ` · ${p.note}` : ""}`
                      : formatBytes(t, p.file.size)}
                </span>
                {p.status === "uploading" && (
                  <span className="progress">
                    <span style={{ width: `${p.progress}%` }} />
                  </span>
                )}
                {p.status !== "uploading" && (
                  <button
                    type="button"
                    className="chat-icon-btn"
                    onClick={() => setPending((ps) => ps.filter((x) => x.key !== p.key))}
                    title={t.chat.removeFile}
                    aria-label={t.chat.removeFile}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <form
          className="chat-composer"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <button
            type="button"
            className="chat-attach-btn"
            onClick={() => fileInput.current?.click()}
            title={t.chat.attach}
            aria-label={t.chat.attach}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) addFiles(Array.from(e.target.files));
              e.target.value = "";
            }}
          />
          <textarea
            ref={composer}
            rows={1}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData.files);
              if (files.length) {
                e.preventDefault();
                addFiles(files);
              }
            }}
            value={draft}
            maxLength={2000}
            onChange={(e) => {
              setDraft(e.target.value);
              if (e.target.value) pingTyping();
            }}
            onKeyDown={onComposerKey}
            placeholder={active ? t.chat.placeholder(active.name) : ""}
            title={t.chat.sendHint}
          />
          <button type="submit" className="btn btn-accent" disabled={!canSend}>
            {t.chat.send}
          </button>
        </form>
      </section>

      <aside className="chat-members">
        <div className="chat-side-title">
          <span>{t.chat.online(online.length)}</span>
        </div>
        <ul>
          {online.map((u) => (
            <li key={u.id}>
              <span className="chat-member-avatar">
                <Avatar name={u.name} src={u.avatar} size={30} />
                <span className="chat-dot" />
              </span>
              <span className="chat-member-name">{u.name}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
