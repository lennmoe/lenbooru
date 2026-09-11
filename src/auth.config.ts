import type { NextAuthConfig } from "next-auth";
import Discord from "next-auth/providers/discord";
import type { Role } from "@/lib/perms";

/**
 * Edge-safe Auth.js config shared by the middleware and the full server config.
 * No database access here — the DB-backed role lookup lives in `src/auth.ts`.
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [
    Discord({
      clientId: process.env.AUTH_DISCORD_ID,
      clientSecret: process.env.AUTH_DISCORD_SECRET,
      authorization: { params: { scope: "identify" } },
    }),
  ],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    session({ session, token }) {
      if (session.user) {
        session.user.discordId = (token.discordId as string) ?? "";
        session.user.role = (token.role as Role | null) ?? null;
        if (token.username) session.user.name = token.username as string;
        if (token.picture) session.user.image = token.picture as string;
      }
      return session;
    },
  },
};

export default authConfig;
