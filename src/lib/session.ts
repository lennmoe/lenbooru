import { auth } from "@/auth";
import type { Role } from "./perms";

export async function currentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function currentRole(): Promise<Role | null> {
  const session = await auth();
  return (session?.user?.role as Role | null) ?? null;
}
