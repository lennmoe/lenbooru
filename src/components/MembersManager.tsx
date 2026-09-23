"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROLES, type Role } from "@/lib/perms";
import { useT } from "./I18nProvider";
import type { UserRow } from "@/lib/users";

const ASSIGNABLE: Role[] = ["viewer", "editor", "uploader"];

export default function MembersManager({
  initial,
  ownerId,
}: {
  initial: UserRow[];
  ownerId: string;
}) {
  const router = useRouter();
  const t = useT();
  const [users, setUsers] = useState<UserRow[]>(initial);
  const [discordId, setDiscordId] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/members");
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
    router.refresh();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordId: discordId.trim(), role, username: username.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || t.common.error(res.status));
        return;
      }
      setDiscordId("");
      setUsername("");
      setRole("viewer");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(id: string, next: Role) {
    await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discordId: id, role: next }),
    });
    await refresh();
  }

  async function remove(id: string) {
    if (!confirm(t.members.removeConfirm)) return;
    await fetch(`/api/members?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <div className="members">
      <form className="member-add" onSubmit={add}>
        <div className="field">
          <label htmlFor="did">{t.members.discordId}</label>
          <input
            id="did"
            type="text"
            inputMode="numeric"
            placeholder={t.members.idPlaceholder}
            value={discordId}
            onChange={(e) => setDiscordId(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="uname">{t.members.username}</label>
          <input
            id="uname"
            type="text"
            placeholder={t.members.usernamePlaceholder}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="mrole">{t.members.role}</label>
          <select
            id="mrole"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {ASSIGNABLE.map((r) => (
              <option key={r} value={r}>
                {t.roles[r]}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-accent" type="submit" disabled={busy}>
          {busy ? "…" : t.members.add}
        </button>
      </form>
      <p className="role-hint">{t.roleHints[role]}</p>
      {err && <div className="msg err">{err}</div>}

      <ul className="member-list">
        {users.map((u) => {
          const isOwner = u.discord_id === ownerId || u.role === "owner";
          return (
            <li key={u.discord_id}>
              <div className="member-main">
                <strong>{u.username || "—"}</strong>
                <code>{u.discord_id}</code>
              </div>
              {isOwner ? (
                <span className="tag">{t.members.ownerTag}</span>
              ) : (
                <>
                  <select
                    value={u.role}
                    onChange={(e) =>
                      changeRole(u.discord_id, e.target.value as Role)
                    }
                  >
                    {ROLES.filter((r) => r !== "owner").map((r) => (
                      <option key={r} value={r}>
                        {t.roles[r]}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-danger"
                    onClick={() => remove(u.discord_id)}
                  >
                    {t.members.remove}
                  </button>
                </>
              )}
            </li>
          );
        })}
        {users.length === 0 && (
          <li style={{ color: "var(--text-dim)" }}>{t.members.none}</li>
        )}
      </ul>
    </div>
  );
}
