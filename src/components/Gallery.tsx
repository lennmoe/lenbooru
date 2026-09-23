"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Post } from "@/lib/db";
import PostCard from "./PostCard";
import { useT } from "./I18nProvider";

interface Props {
  initial: Post[];
  type: string | null;
  tags: string[];
  pageSize: number;
}

export default function Gallery({ initial, type, tags, pageSize }: Props) {
  const t = useT();
  const [posts, setPosts] = useState<Post[]>(initial);
  const [offset, setOffset] = useState(initial.length);
  const [done, setDone] = useState(initial.length < pageSize);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  // reset when filters change
  useEffect(() => {
    setPosts(initial);
    setOffset(initial.length);
    setDone(initial.length < pageSize);
  }, [initial, pageSize]);

  const loadMore = useCallback(async () => {
    if (loading || done) return;
    setLoading(true);
    const qs = new URLSearchParams();
    if (type) qs.set("type", type);
    if (tags.length) qs.set("tags", tags.join(" "));
    qs.set("offset", String(offset));
    qs.set("limit", String(pageSize));
    try {
      const res = await fetch(`/api/posts?${qs}`);
      const data = await res.json();
      setPosts((prev) => [...prev, ...data.posts]);
      setOffset(data.nextOffset);
      setDone(data.done);
    } finally {
      setLoading(false);
    }
  }, [loading, done, type, tags, offset, pageSize]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "800px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  if (!posts.length) {
    return (
      <p className="empty">
        {t.gallery.empty} <a href="/upload">{t.gallery.uploadFirst}</a>
      </p>
    );
  }

  return (
    <>
      <div className="grid">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </div>
      <div ref={sentinel} className="sentinel" />
      {loading && <p className="loading">{t.gallery.loading}</p>}
      {done && <p className="loading">{t.gallery.end}</p>}
    </>
  );
}
