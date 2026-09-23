"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil } from "./Icons";
import { useT } from "./I18nProvider";

type Fit = "original" | "width" | "height" | "both";

const FITS: Fit[] = ["original", "width", "height", "both"];

const FIT_KEY = "lenbooru.fit";

interface Props {
  newer: number | null;
  older: number | null;
  editHref: string | null;
  /** false for doujins: the media block is a cover + page strip, not a single file */
  zoomable: boolean;
  info: React.ReactNode;
  sidebar: React.ReactNode;
  media: React.ReactNode;
}

export default function PostView({ newer, older, editHref, zoomable, info, sidebar, media }: Props) {
  const router = useRouter();
  const t = useT();
  const [fit, setFit] = useState<Fit>("both");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(FIT_KEY) as Fit | null;
      if (saved && FITS.includes(saved)) setFit(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  function choose(f: Fit) {
    setFit(f);
    try {
      localStorage.setItem(FIT_KEY, f);
    } catch {
      /* storage unavailable */
    }
  }

  // ← / → : previous / next post, E : edit
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === "ArrowLeft" && newer) router.push(`/post/${newer}`);
      else if (e.key === "ArrowRight" && older) router.push(`/post/${older}`);
      else if ((e.key === "e" || e.key === "E") && editHref) router.push(editHref);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newer, older, editHref, router]);

  return (
    <div className="post-layout">
      <aside className="post-side">
        <nav className="post-nav">
          {newer ? (
            <Link href={`/post/${newer}`} title={`${t.post.prev} (←)`} aria-label={t.post.prev}>
              <ChevronLeft />
            </Link>
          ) : (
            <span className="off" aria-hidden="true">
              <ChevronLeft />
            </span>
          )}
          {older ? (
            <Link href={`/post/${older}`} title={`${t.post.next} (→)`} aria-label={t.post.next}>
              <ChevronRight />
            </Link>
          ) : (
            <span className="off" aria-hidden="true">
              <ChevronRight />
            </span>
          )}
          {editHref ? (
            <Link href={editHref} title={`${t.post.edit} (E)`} aria-label={t.post.edit}>
              <Pencil />
            </Link>
          ) : (
            <span />
          )}
        </nav>

        {info}

        {zoomable && (
          <p className="post-fit">
            {FITS.map((f, i) => (
              <span key={f}>
                {i > 0 && " · "}
                <button
                  type="button"
                  className={fit === f ? "active" : ""}
                  onClick={() => choose(f)}
                >
                  {t.post.fits[f]}
                </button>
              </span>
            ))}
          </p>
        )}

        {sidebar}
      </aside>

      <div className="post-stage" data-fit={zoomable ? fit : undefined}>
        {media}
      </div>
    </div>
  );
}
