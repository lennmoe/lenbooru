import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { resolveRole } from "@/lib/users";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, profile }) {
      if (profile) {
        const p = profile as {
          id?: string;
          username?: string;
          global_name?: string;
          avatar?: string;
        };
        if (p.id) token.discordId = p.id;
        token.username = p.global_name || p.username || token.username || "";
        if (p.id && p.avatar) {
          token.picture = `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.png?size=64`;
        }
      }

      const id = (token.discordId as string) || (token.sub as string) || "";
      if (id) {
        token.discordId = id;
        token.role = resolveRole(id, token.username as string | undefined);
      }
      return token;
    },
  },
});
