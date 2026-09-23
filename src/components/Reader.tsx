"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useT } from "./I18nProvider";

interface Props {
  postId: number;
  title: string;
  pages: { page_no: number; file: string }[];
}

export default function Reader({ postId, title, pages }: Props) {
  const t = useT();
  const [current, setCurrent] = useState(1);
  const containers = useRef<(HTMLImageElement | null)[]>([]);

  // track which page is in view
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const n = Number((e.target as HTMLElement).dataset.page);
            if (n) setCurrent(n);
          }
        }
      },
      { threshold: 0.4 }
    );
    containers.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [pages.length]);

  // jump to #pN on load
  useEffect(() => {
    const m = window.location.hash.match(/p(\d+)/);
    if (m) {
      const idx = Number(m[1]) - 1;
      containers.current[idx]?.scrollIntoView();
    }
  }, []);

  return (
    <div className="reader">
      <div className="reader-bar">
        <Link href={`/post/${postId}`} className="btn">
          {t.reader.back}
        </Link>
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </span>
        <span style={{ color: "var(--text-dim)", whiteSpace: "nowrap" }}>
          {pages.length}p
        </span>
      </div>

      {pages.map((pg, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={pg.page_no}
          ref={(el) => {
            containers.current[i] = el;
          }}
          data-page={pg.page_no}
          src={`/media/doujin/${postId}/${pg.file}`}
          alt={`page ${pg.page_no}`}
          loading={i < 2 ? "eager" : "lazy"}
        />
      ))}

      <div className="page-indicator">
        {current} / {pages.length}
      </div>
    </div>
  );
}
