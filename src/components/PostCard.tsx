"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { Post } from "@/lib/db";
import { useT } from "./I18nProvider";

function mediaSrc(p: Post) {
  if (p.type === "image" || p.type === "gif") return `/media/image/${p.id}.${p.ext}`;
  if (p.type === "video") return `/media/video/${p.id}.${p.ext}`;
  return `/media/thumb/${p.id}.webp`;
}

/** Width / height ratio, clamped so panoramas and very tall images stay usable. */
function ratioOf(p: Post): number {
  const r = p.width && p.height ? p.width / p.height : p.type === "video" ? 16 / 9 : 3 / 4;
  return Math.min(Math.max(r, 0.4), 2.5);
}

export default function PostCard({ post }: { post: Post }) {
  const t = useT();
  const [thumbFailed, setThumbFailed] = useState(false);
  const thumb = `/media/thumb/${post.id}.webp`;
  const video = useRef<HTMLVideoElement>(null);
  const isVideo = post.type === "video";

  // videos have no thumbnail: show the first frame, play muted in a loop on hover
  function play() {
    video.current?.play().catch(() => {});
  }
  function stop() {
    const v = video.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0.1;
  }

  return (
    <Link
      href={`/post/${post.id}`}
      className={`card${isVideo ? " card-video" : ""}`}
      data-rating={post.rating || "none"}
      title={`#${post.id}`}
      onMouseEnter={isVideo ? play : undefined}
      onMouseLeave={isVideo ? stop : undefined}
      onFocus={isVideo ? play : undefined}
      onBlur={isVideo ? stop : undefined}
      style={{ "--r": ratioOf(post) } as React.CSSProperties}
    >
      {isVideo ? (
        <video
          ref={video}
          src={`${mediaSrc(post)}#t=0.1`}
          muted
          loop
          playsInline
          preload="metadata"
        />
      ) : (
        <img
          src={thumbFailed ? mediaSrc(post) : thumb}
          alt={post.tags.join(" ")}
          loading="lazy"
          onError={() => setThumbFailed(true)}
        />
      )}

      {post.type === "doujin" && <span className="badge doujin">doujin</span>}
      {post.type === "video" && <span className="badge video">{t.gallery.badgeVideo}</span>}
      {post.type === "gif" && <span className="badge gif">gif</span>}

      {post.type === "doujin" && post.page_count > 0 && (
        <span className="pages">{post.page_count}p</span>
      )}

      {post.type === "video" && (
        <svg className="play" viewBox="0 0 24 24" fill="#fff" aria-hidden>
          <circle cx="12" cy="12" r="12" fill="rgba(0,0,0,.55)" />
          <path d="M9 7.5v9l7-4.5z" />
        </svg>
      )}

    </Link>
  );
}
