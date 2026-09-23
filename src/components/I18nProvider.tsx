"use client";

import { createContext, useContext } from "react";
import { DICTS, type Dict, type Lang } from "@/lib/i18n/dict";

const Ctx = createContext<Lang>("fr");

/** The language is picked on the server (cookie) and handed down once from the root layout. */
export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}

export function useLang(): Lang {
  return useContext(Ctx);
}

export function useT(): Dict {
  return DICTS[useContext(Ctx)];
}
