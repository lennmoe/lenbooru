import { headers } from "next/headers";

/** Public origin of the site (AUTH_URL), falling back to the request's host. */
export async function siteOrigin(): Promise<string> {
  const env = process.env.AUTH_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}
