import { cookies, headers } from "next/headers";
import { DEFAULT_LANG, DICTS, LANG_COOKIE, isLang, type Dict, type Lang } from "./dict";

/** Language: explicit choice (cookie) > browser Accept-Language > French. */
export async function getLang(): Promise<Lang> {
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(saved)) return saved;
  const accept = (await headers()).get("accept-language") ?? "";
  const first = accept.split(",")[0]?.trim().slice(0, 2).toLowerCase();
  if (first === "en") return "en";
  return DEFAULT_LANG;
}

export async function getT(): Promise<Dict> {
  return DICTS[await getLang()];
}
