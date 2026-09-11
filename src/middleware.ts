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

  const user = req.auth?.user;
  if (!user) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
  if (!user.role) {
    return Response.redirect(new URL("/denied", req.nextUrl));
  }
});

// `/api/*` is intentionally excluded: those routes guard themselves with auth()
// and JSON errors, and keeping them out of middleware avoids Next's 10MB
// buffered-body limit on uploads that pass through middleware.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
