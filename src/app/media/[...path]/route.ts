import { NextRequest } from "next/server";
import path from "node:path";
import { auth } from "@/auth";
import { MEDIA_DIR } from "@/lib/paths";
import { canRead } from "@/lib/perms";
import { serveFile } from "@/lib/serveFile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await auth();
  if (!canRead(session?.user?.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { path: parts } = await params;
  const rel = parts.map((p) => decodeURIComponent(p)).join("/");
  const abs = path.resolve(MEDIA_DIR, rel);

  // block path traversal
  if (abs !== MEDIA_DIR && !abs.startsWith(MEDIA_DIR + path.sep)) {
    return new Response("Forbidden", { status: 403 });
  }

  return serveFile(req, abs);
}
