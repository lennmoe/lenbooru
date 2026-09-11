import { getDb } from "./db";
import type { Role } from "./perms";
import { ROLES } from "./perms";

export const OWNER_ID =
  process.env.OWNER_DISCORD_ID?.trim() || "435068712786198538";

export interface UserRow {
  discord_id: string;
  username: string;
  role: Role;
  added_at: number;
}

/** Resolve a Discord id to a role. null = authenticated but not whitelisted. */
export function resolveRole(
  discordId: string,
  username?: string
): Role | null {
  if (!discordId) return null;
  const db = getDb();

  if (discordId === OWNER_ID) {
    db.prepare(
      `INSERT INTO users (discord_id, username, role, added_at)
       VALUES (@id, @u, 'owner', @t)
       ON CONFLICT(discord_id) DO UPDATE SET role = 'owner'`
    ).run({ id: discordId, u: username ?? "", t: Date.now() });
    return "owner";
  }

  const row = db
    .prepare("SELECT discord_id, username, role, added_at FROM users WHERE discord_id = ?")
    .get(discordId) as UserRow | undefined;
  if (!row) return null;
  if (username && username !== row.username) {
    db.prepare("UPDATE users SET username = ? WHERE discord_id = ?").run(
      username,
      discordId
    );
  }
  return row.role;
}

export function listUsers(): UserRow[] {
  return getDb()
    .prepare(
      `SELECT discord_id, username, role, added_at FROM users
       ORDER BY (role = 'owner') DESC, added_at DESC`
    )
    .all() as UserRow[];
}

export function setUser(discordId: string, role: Role, username = ""): boolean {
  if (!/^\d{5,25}$/.test(discordId)) return false;
  if (!ROLES.includes(role)) return false;
  getDb()
    .prepare(
      `INSERT INTO users (discord_id, username, role, added_at)
       VALUES (@id, @u, @r, @t)
       ON CONFLICT(discord_id) DO UPDATE SET
         role = @r,
         username = CASE WHEN @u <> '' THEN @u ELSE username END`
    )
    .run({ id: discordId, u: username, r: role, t: Date.now() });
  return true;
}

export function removeUser(discordId: string): boolean {
  if (discordId === OWNER_ID) return false;
  getDb().prepare("DELETE FROM users WHERE discord_id = ?").run(discordId);
  return true;
}
