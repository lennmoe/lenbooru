"use client";

// Sign in / out through Auth.js's own /api/auth routes (CSRF-token protected)
// instead of Server Actions, whose Origin-vs-Host check fails behind tunnels
// and reverse proxies ("Invalid Server Actions request").
import { signIn, signOut } from "next-auth/react";
import { useState } from "react";
import DiscordLogo from "./DiscordLogo";
import { useT } from "./I18nProvider";

export function DiscordSignInButton() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-discord"
      type="button"
      style={{ width: "100%" }}
      disabled={busy}
      onClick={() => {
        setBusy(true);
        signIn("discord", { redirectTo: "/" }).catch(() => setBusy(false));
      }}
    >
      <DiscordLogo />
      {busy ? t.auth.redirecting : t.auth.signIn}
    </button>
  );
}

export function SignOutButton({
  className = "btn",
  style,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      role="menuitem"
      className={className}
      style={style}
      disabled={busy}
      onClick={() => {
        setBusy(true);
        signOut({ redirectTo: "/login" }).catch(() => setBusy(false));
      }}
    >
      {busy ? t.auth.signingOut : children}
    </button>
  );
}
