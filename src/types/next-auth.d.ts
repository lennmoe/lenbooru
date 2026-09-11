import type { Role } from "@/lib/perms";

declare module "next-auth" {
  interface Session {
    user: {
      discordId: string;
      role: Role | null;
      name?: string | null;
      image?: string | null;
      email?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discordId?: string;
    username?: string;
    role?: Role | null;
    picture?: string;
  }
}

export {};
