import { createHmac, timingSafeEqual } from "node:crypto";
import type { PostRow } from "./db";

/**
 * Signed public links for sharing a post's file on Discord (or anywhere) while
 * the site itself stays private: /s/<id>-<sig>.<ext>. The signature is an HMAC
 * of the post id with AUTH_SECRET, so links can't be guessed or forged.
 * Changing AUTH_SECRET revokes every link; deleting the post revokes its own.
 */

function sign(id: number): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET manquant");
  return createHmac("sha256", secret).update(`share:${id}`).digest("base64url").slice(0, 22);
}

export function verifyShare(id: number, sig: string): boolean {
  const a = Buffer.from(sign(id));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Extension shown in the link: the file Discord will receive. */
function shareExt(post: Pick<PostRow, "type" | "ext">, doujinCoverExt?: string): string {
  if (post.type === "doujin") return (doujinCoverExt || ".jpg").replace(/^\./, "");
  return post.ext;
}

export function sharePath(post: Pick<PostRow, "id" | "type" | "ext">, doujinCoverExt?: string): string {
  return `/s/${post.id}-${sign(post.id)}.${shareExt(post, doujinCoverExt)}`;
}

/** Parse "<id>-<sig>.<ext>" → { id, sig } */
export function parseShareSlug(slug: string): { id: number; sig: string } | null {
  const m = /^(\d+)-([A-Za-z0-9_-]{22})(?:\.[a-z0-9]+)?$/i.exec(slug);
  return m ? { id: parseInt(m[1], 10), sig: m[2] } : null;
}
