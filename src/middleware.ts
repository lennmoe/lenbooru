import NextAuth from "next-auth";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // always-public paths
  if (
    pathname.startsWith("/api") ||
    pathname === "/login" ||
    pathname === "/denied"
  ) {
    return;
  }

  // Only checks that the visitor is logged in. The role stored in the cookie can
  // be stale (whitelist changed since login), so role checks happen server-side
  // where it's re-read from the DB: app/(board)/layout.tsx, /media, /api/*.
  if (!req.auth?.user) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
});

// `/api/*` is intentionally excluded: those routes guard themselves with auth()
// and JSON errors, and keeping them out of middleware avoids Next's 10MB
// buffered-body limit on uploads that pass through middleware.
export const config = {
  // Public, skipped entirely so no session cookies get attached to what Discord fetches:
  // /s/* (signed share links) and root-level images = files from public/ (embed image).
  matcher: [
    "/((?!api|s/|_next/static|_next/image|favicon.ico|[^/]+\.(?:png|jpe?g|gif|webp|svg|ico)$).*)",
  ],
};
