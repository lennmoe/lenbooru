import { auth } from "@/auth";
import { canManageUsers, canRead, type Role } from "./perms";
import type { ChatUser } from "./chatHub";

/** The signed-in member for chat routes (any whitelisted role), or null. */
export async function chatMember(): Promise<{ user: ChatUser; role: Role; isOwner: boolean } | null> {
  const session = await auth();
  const u = session?.user;
  if (!u || !canRead(u.role) || !u.discordId) return null;
  return {
    user: { id: u.discordId, name: u.name || "?", avatar: u.image || "" },
    role: u.role as Role,
    isOwner: canManageUsers(u.role),
  };
}
