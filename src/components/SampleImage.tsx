"use client";

import { useState } from "react";
import { useT } from "./I18nProvider";

/**
 * Post image that starts with the light sample of a heavy original, Danbooru-style:
 * "Resized to 67% of original (view original)". Zoom modes still apply (CSS).
 */
export default function SampleImage({
  sample,
  original,
  percent,
  alt,
  width,
  height,
}: {
  sample: string;
  original: string;
  percent: number;
  alt: string;
  width: number | null;
  height: number | null;
}) {
  const t = useT();
  const [showOriginal, setShowOriginal] = useState(false);

  return (
    <>
      <p className="sample-notice">
        {showOriginal ? (
          <button type="button" onClick={() => setShowOriginal(false)}>
            {t.sample.viewSample}
          </button>
        ) : (
          <>
            {t.sample.resized(percent)} (
            <button type="button" onClick={() => setShowOriginal(true)}>
              {t.sample.viewOriginal}
            </button>
            )
          </>
        )}
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={showOriginal ? "original" : "sample"}
        src={showOriginal ? original : sample}
        alt={alt}
        width={width ?? undefined}
        height={height ?? undefined}
      />
    </>
  );
}
