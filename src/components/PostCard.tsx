"use client";

import Link from "next/link";
import { useState } from "react";
import type { Post } from "@/lib/db";

function mediaSrc(p: Post) {
  if (p.type === "image") return `/media/image/${p.id}.${p.ext}`;
  if (p.type === "video") return `/media/video/${p.id}.${p.ext}`;
  return `/media/thumb/${p.id}.webp`;
}

export default function PostCard({ post }: { post: Post }) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const thumb = `/media/thumb/${post.id}.webp`;

  return (
    <Link href={`/post/${post.id}`} className="card" title={post.title}>
      {post.type === "video" && thumbFailed ? (
        <video
          src={`${mediaSrc(post)}#t=0.1`}
          muted
          playsInline
          preload="metadata"
        />
      ) : (
        <img
          src={thumbFailed ? mediaSrc(post) : thumb}
          alt={post.title}
          loading="lazy"
          onError={() => setThumbFailed(true)}
        />
      )}

      {post.type === "doujin" && <span className="badge doujin">doujin</span>}
      {post.type === "video" && <span className="badge video">vidéo</span>}

      {post.type === "doujin" && post.page_count > 0 && (
        <span className="pages">{post.page_count}p</span>
      )}

      {post.type === "video" && (
        <svg className="play" viewBox="0 0 24 24" fill="#fff" aria-hidden>
          <circle cx="12" cy="12" r="12" fill="rgba(0,0,0,.55)" />
          <path d="M9 7.5v9l7-4.5z" />
        </svg>
      )}

      {post.title && <div className="title-strip">{post.title}</div>}
    </Link>
  );
}
