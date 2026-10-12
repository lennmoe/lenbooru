"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Item {
  href: string;
  label: string;
}

/** Header tabs, Danbooru-style: the section you are in is highlighted. */
export default function NavLinks({ items }: { items: Item[] }) {
  const path = usePathname();
  // "/" owns the gallery and everything under /post and /doujin
  const isActive = (href: string) =>
    href === "/"
      ? path === "/" || path.startsWith("/post") || path.startsWith("/doujin")
      : path === href || path.startsWith(href + "/");

  return (
    <nav className="main-nav">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className={isActive(it.href) ? "active" : undefined}
          aria-current={isActive(it.href) ? "page" : undefined}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
