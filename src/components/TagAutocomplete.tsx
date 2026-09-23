"use client";

import { useRef, useState } from "react";
import type { TagCategory } from "@/lib/tags";
import { displayTag, parseTag } from "@/lib/tags";
import { useT } from "./I18nProvider";

interface Suggestion {
  name: string;
  category: TagCategory;
  count: number;
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

/** The token being typed: from the last space / comma / newline before the caret to the caret. */
function currentToken(value: string, caret: number): { start: number; text: string } {
  const before = value.slice(0, caret);
  const m = /[^\s,]*$/.exec(before);
  const text = m ? m[0] : "";
  return { start: caret - text.length, text };
}

type FieldProps = {
  id?: string;
  name?: string;
  placeholder?: string;
  className?: string;
};

interface Props extends FieldProps {
  value: string;
  onChange: (value: string) => void;
  /** "input" for the search bar, "textarea" for tag fields (upload / edit) */
  as?: "input" | "textarea";
  /** only suggest tags of this category (the Parodies / Characters fields) */
  category?: TagCategory;
  rows?: number;
}

/**
 * Tag field with Danbooru-like autocomplete on the word being typed. A category
 * prefix typed by the user ("char:nar") is kept when picking ("char:naruto_uzumaki").
 */
export default function TagAutocomplete({ value, onChange, as = "input", rows, category, ...field }: Props) {
  const t = useT();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const reqId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listId = useRef(`ac-${Math.random().toString(36).slice(2, 8)}`).current;

  function query(text: string) {
    const q = parseTag(text.replace(/^-/, "")).name;
    const id = ++reqId.current;
    if (!q) {
      setItems([]);
      setOpen(false);
      return;
    }
    fetch(`/api/tags?q=${encodeURIComponent(q)}${category ? `&category=${category}` : ""}`)
      .then((r) => (r.ok ? r.json() : { tags: [] }))
      .then((data: { tags: Suggestion[] }) => {
        if (id !== reqId.current) return; // a newer keystroke won
        // nothing to suggest if the only match is exactly what's typed
        const useful = data.tags.filter((s) => s.name !== q || data.tags.length > 1);
        setItems(useful);
        setActive(-1);
        setOpen(useful.length > 0);
      })
      .catch(() => {});
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const v = e.target.value;
    onChange(v);
    const { text } = currentToken(v, e.target.selectionStart ?? v.length);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => query(text), 120);
  }

  function pick(s: Suggestion) {
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const { start, text } = currentToken(value, caret);
    // keep "-" (exclusion) and a category prefix the user typed
    const lead = text.startsWith("-") ? "-" : "";
    const body = lead ? text.slice(1) : text;
    const colon = body.indexOf(":");
    const prefix = colon > 0 && parseTag(body).category ? body.slice(0, colon + 1) : "";
    const insert = lead + prefix + s.name + " ";
    const rest = value.slice(caret).replace(/^[^\s,]*[\s,]*/, "");
    const next = value.slice(0, start) + insert + rest;
    onChange(next);
    setOpen(false);
    setItems([]);
    requestAnimationFrame(() => {
      const pos = start + insert.length;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === "Tab") {
      e.preventDefault();
      pick(items[active >= 0 ? active : 0]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  const common = {
    ...field,
    ref,
    value,
    onChange: handleChange,
    onKeyDown,
    onBlur: () => setOpen(false),
    autoComplete: "off",
    spellCheck: false,
    role: "combobox",
    "aria-expanded": open,
    "aria-controls": listId,
    "aria-autocomplete": "list" as const,
  };

  return (
    <div className="ac-wrap">
      {as === "textarea" ? <textarea {...common} rows={rows} /> : <input type="search" {...common} />}
      {open && (
        <ul id={listId} className="ac-list" role="listbox" aria-label={t.suggestions}>
          {items.map((s, i) => (
            <li
              key={s.name}
              role="option"
              aria-selected={i === active}
              className={i === active ? "active" : ""}
              // mousedown (not click) so the field doesn't blur and close the list first
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className={`ac-name tag-${s.category}`}>{displayTag(s.name)}</span>
              <span className="ac-count">{fmtCount(s.count)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
