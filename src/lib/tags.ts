/**
 * Tag categories, Danbooru-style. The category is picked with a prefix when
 * tagging — "parody:naruto", "char:naruto_uzumaki", "artist:kishimoto" — and
 * sticks to the tag afterwards: typing plain "naruto" later keeps it a parody.
 * No prefix = general. Safe to import from client components (no DB access).
 */

export type TagCategory = "artist" | "copyright" | "character" | "general";

/** Display order on a post, like Danbooru. */
export const TAG_CATEGORIES: TagCategory[] = ["artist", "copyright", "character", "general"];

const PREFIXES: Record<string, TagCategory> = {
  artist: "artist",
  art: "artist",
  copyright: "copyright",
  copy: "copyright",
  parody: "copyright",
  series: "copyright",
  character: "character",
  char: "character",
  chara: "character",
  general: "general",
  gen: "general",
};

export function isTagCategory(v: unknown): v is TagCategory {
  return v === "artist" || v === "copyright" || v === "character" || v === "general";
}

/**
 * "Char:Naruto_Uzumaki" -> { name: "naruto_uzumaki", category: "character" }.
 * `category` is null when no known prefix was given (keep the tag's current one).
 */
export function parseTag(raw: string): { name: string; category: TagCategory | null } {
  const s = raw.trim().toLowerCase();
  const i = s.indexOf(":");
  if (i > 0) {
    const cat = PREFIXES[s.slice(0, i)];
    if (cat) return { name: s.slice(i + 1), category: cat };
  }
  return { name: s, category: null };
}

/** Search terms ignore category prefixes: "parody:naruto" searches for "naruto". */
export function normalizeSearchTag(raw: string): string {
  return parseTag(raw).name;
}

/** Split a free-text tag field ("a b, c") into raw tokens. */
export function splitTags(input: string): string[] {
  return input
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Prefix to write a tag back in an edit field ("" for general). */
export function tagPrefix(category: TagCategory): string {
  if (category === "copyright") return "parody:";
  if (category === "character") return "char:";
  if (category === "artist") return "artist:";
  return "";
}

/** Danbooru shows tags with spaces instead of underscores. */
export function displayTag(name: string): string {
  return name.replace(/_/g, " ");
}

/** Danbooru ratings: general, sensitive, questionable, explicit. "" = not rated. */
export type Rating = "g" | "s" | "q" | "e";
export const RATINGS: Rating[] = ["g", "s", "q", "e"];

const RATING_WORDS: Record<string, Rating> = {
  g: "g",
  general: "g",
  safe: "g",
  s: "s",
  sensitive: "s",
  q: "q",
  questionable: "q",
  e: "e",
  explicit: "e",
};

export function isRating(v: unknown): v is Rating {
  return v === "g" || v === "s" || v === "q" || v === "e";
}

/**
 * Parse a search box: tags (category prefixes ignored) plus an optional
 * "rating:e" / "rating:explicit" filter, like Danbooru.
 */
export function parseSearch(input: string): { tags: string[]; rating: Rating | null } {
  let rating: Rating | null = null;
  const tags: string[] = [];
  for (const raw of splitTags(input)) {
    const m = /^rating:(\w+)$/i.exec(raw);
    if (m && RATING_WORDS[m[1].toLowerCase()]) {
      rating = RATING_WORDS[m[1].toLowerCase()];
      continue;
    }
    const name = normalizeSearchTag(raw);
    if (name && !tags.includes(name)) tags.push(name);
  }
  return { tags, rating };
}

/** Free-text source (URL or description), trimmed and capped. */
export function cleanSource(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, 500) : "";
}

/** Upload / edit forms: dedicated Parodies and Characters fields next to the tag field. */
export interface TagFields {
  tags: string;
  parodies: string;
  characters: string;
}

/**
 * Merge the three fields into one tag string for the API. Names typed in the
 * Parodies / Characters fields get their prefix (any prefix typed there is replaced).
 */
export function joinTagFields(f: TagFields): string {
  const withPrefix = (field: string, prefix: string) =>
    splitTags(field)
      .map((raw) => parseTag(raw).name)
      .filter(Boolean)
      .map((name) => prefix + name);
  return [...splitTags(f.tags), ...withPrefix(f.parodies, "parody:"), ...withPrefix(f.characters, "char:")].join(" ");
}

/** Inverse of joinTagFields for the edit form (artists stay in the tag field as "artist:x"). */
export function splitTagFields(tags: { name: string; category: TagCategory }[]): TagFields {
  const of = (cat: TagCategory) => tags.filter((t) => t.category === cat).map((t) => t.name).join(" ");
  return {
    parodies: of("copyright"),
    characters: of("character"),
    tags: tags
      .filter((t) => t.category === "artist" || t.category === "general")
      .map((t) => tagPrefix(t.category) + t.name)
      .join(" "),
  };
}
