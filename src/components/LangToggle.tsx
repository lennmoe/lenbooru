"use client";

import { useRouter } from "next/navigation";
import { LANG_COOKIE } from "@/lib/i18n/dict";
import { useLang, useT } from "./I18nProvider";

export default function LangToggle() {
  const router = useRouter();
  const lang = useLang();
  const t = useT();

  function toggle() {
    const next = lang === "fr" ? "en" : "fr";
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next;
    router.refresh();
  }

  return (
    <button
      type="button"
      className="icon-btn lang-btn"
      onClick={toggle}
      title={t.lang.switchTo}
      aria-label={t.lang.switchTo}
    >
      {t.lang.short}
    </button>
  );
}
