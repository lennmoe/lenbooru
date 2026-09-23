"use client";

import { useEffect, useRef, useState } from "react";
import { SignOutButton } from "./AuthButtons";
import { useT } from "./I18nProvider";
import type { Role } from "@/lib/perms";

interface Props {
  name: string;
  image: string | null;
  role: Role;
}

function Avatar({ name, image, size }: { name: string; image: string | null; size: number }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="avatar" src={image} alt="" width={size} height={size} />;
  }
  return (
    <span className="avatar avatar-fallback" style={{ width: size, height: size }}>
      {(name.trim()[0] || "?").toUpperCase()}
    </span>
  );
}

export default function UserMenu({ name, image, role }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar name={name} image={image} size={26} />
        <span className="user-name">{name}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="chev">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="user-dropdown" role="menu">
          <div className="user-card">
            <Avatar name={name} image={image} size={40} />
            <div>
              <strong>{name}</strong>
              <span className="user-role">{t.roles[role]}</span>
            </div>
          </div>
          <SignOutButton className="menu-item danger">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            {t.auth.signOut}
          </SignOutButton>
        </div>
      )}
    </div>
  );
}
