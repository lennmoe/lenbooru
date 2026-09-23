"use client";

import { useEffect, useState } from "react";
import { useT } from "./I18nProvider";

export const SAFE_COOKIE = "safe";

/**
 * Safe mode: blurs every image / video that isn't rated General (hover to peek).
 * The choice lives in a cookie so the server renders <html data-safe> directly
 * and nothing shows unblurred while the page loads.
 */
export default function SafeModeToggle() {
  const t = useT();
  const [on, setOn] = useState(false);

  useEffect(() => setOn(document.documentElement.hasAttribute("data-safe")), []);

  function toggle() {
    const next = !on;
    if (next) {
      document.documentElement.setAttribute("data-safe", "");
      document.cookie = `${SAFE_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
    } else {
      document.documentElement.removeAttribute("data-safe");
      document.cookie = `${SAFE_COOKIE}=; path=/; max-age=0; samesite=lax`;
    }
    setOn(next);
  }

  const label = on ? t.safe.disable : t.safe.enable;

  return (
    <button
      type="button"
      className={`icon-btn${on ? " safe-on" : ""}`}
      onClick={toggle}
      title={label}
      aria-label={label}
      aria-pressed={on}
    >
      {on ? (
        // eye-off
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" />
        </svg>
      ) : (
        // eye
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}
