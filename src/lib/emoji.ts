/** Chat reaction emojis (shared by the client picker and the API check). */

export const QUICK_EMOJIS = ["👍", "❤️", "😂"];

export const EMOJIS = [
  "👍", "👎", "❤️", "🔥", "😂", "🤣", "😭", "🥺",
  "😍", "🥰", "😘", "😳", "😮", "😱", "🤯", "😡",
  "🤔", "🙄", "😏", "😈", "🥵", "🤤", "😴", "💀",
  "👀", "🙏", "👏", "🙌", "💪", "👌", "🤝", "🫡",
  "🎉", "✨", "💯", "⭐", "💖", "💔", "✅", "❌",
  "🍆", "🍑", "💦", "🤡", "💩", "🗿", "🐐", "🏆",
];

const MAX_EMOJI_LENGTH = 32;

let rgi: RegExp | null | undefined;

/** One single emoji (keycaps, flags, skin tones and ZWJ sequences included). */
export function isEmoji(v: unknown): v is string {
  if (typeof v !== "string" || !v || v.length > MAX_EMOJI_LENGTH) return false;
  if (rgi === undefined) {
    try {
      // built at runtime: the `v` flag is newer than the TS target
      rgi = new RegExp("^\\p{RGI_Emoji}$", "v");
    } catch {
      rgi = null;
    }
  }
  if (rgi) return rgi.test(v);
  return /^\p{Extended_Pictographic}[\p{Extended_Pictographic}\p{Emoji_Modifier}‍️]*$/u.test(v);
}
