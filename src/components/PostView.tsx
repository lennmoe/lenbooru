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
  /** tag groups (Artist / Parody / Character / General) */
  tags: React.ReactNode;
  /** <li> rows of the Information section */
  info: React.ReactNode;
  /** extra <li> rows of the Options section, after the zoom modes */
  options: React.ReactNode;
  /** under the sections (delete button…) */
  footer?: React.ReactNode;
  /** post rating, used by safe mode to blur the media */
  rating: string;
  media: React.ReactNode;
}

/**
 * Post page layout, Danbooru-style: sidebar (navigation, tags, Information,
 * Options) and the media, with zoom modes and ←/→/E shortcuts.
 */
export default function PostView({
  newer,
  older,
  editHref,
  zoomable,
  tags,
  info,
  options,
  footer,
  media,
  rating,
}: Props) {
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

        {tags}

        <section className="post-section">
          <h3>{t.info.title}</h3>
          <ul className="post-info">{info}</ul>
        </section>

        <section className="post-section">
          <h3>{t.info.options}</h3>
          <ul className="post-options">
            {zoomable &&
              FITS.map((f) => (
                <li key={f}>
                  <button
                    type="button"
                    className={fit === f ? "active" : ""}
                    onClick={() => choose(f)}
                  >
                    {t.post.fits[f]}
                  </button>
                </li>
              ))}
            {options}
          </ul>
        </section>

        {footer}
      </aside>

      <div className="post-stage" data-fit={zoomable ? fit : undefined} data-rating={rating || "none"}>
        {media}
      </div>
    </div>
  );
}
