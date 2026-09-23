"use client";

import { useState } from "react";
import DiscordLogo from "./DiscordLogo";
import { useT } from "./I18nProvider";

async function copyText(text: string): Promise<boolean> {
  // navigator.clipboard only exists on https / localhost
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

export default function CopyShareLink({
  url,
  className = "btn btn-discord-outline share-btn",
}: {
  url: string;
  className?: string;
}) {
  const t = useT();
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");

  async function onClick() {
    const ok = await copyText(url);
    if (!ok) window.prompt(t.post.copyPrompt, url);
    setState(ok ? "ok" : "fail");
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      title={t.post.copyHint}
    >
      <DiscordLogo size={16} />
      {state === "ok" ? t.post.copied : t.post.copyDiscord}
    </button>
  );
}
