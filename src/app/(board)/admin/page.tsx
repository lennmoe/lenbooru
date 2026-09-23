import Link from "next/link";
import { redirect } from "next/navigation";
import { currentRole } from "@/lib/session";
import { canManageUsers } from "@/lib/perms";
import { listUsers, OWNER_ID } from "@/lib/users";
import { adminStats } from "@/lib/admin";
import { getT } from "@/lib/i18n/server";
import AdminPosts from "@/components/AdminPosts";
import AdminTags from "@/components/AdminTags";
import MembersManager from "@/components/MembersManager";
import ResetData from "@/components/ResetData";

export const dynamic = "force-dynamic";

const TABS = ["posts", "tags", "members", "data"] as const;
type Tab = (typeof TABS)[number];

/** Owner dashboard: posts (bulk edit), tags, members, data. */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  if (!canManageUsers(await currentRole())) redirect("/");
  const t = await getT();
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "posts";
  const stats = adminStats();

  return (
    <main className="admin-page">
      <div className="admin-head">
        <h1>{t.admin.title}</h1>
        <ul className="admin-stats">
          <li>
            <strong>{stats.posts}</strong> {t.admin.stats.posts}
          </li>
          <li>
            <strong>{stats.tags}</strong> {t.admin.stats.tags}
          </li>
          <li>
            <strong>{stats.members}</strong> {t.admin.stats.members}
          </li>
          <li>
            <strong>{stats.messages}</strong> {t.admin.stats.messages}
          </li>
        </ul>
      </div>

      <nav className="admin-tabs">
        {TABS.map((id) => (
          <Link key={id} href={`/admin?tab=${id}`} className={tab === id ? "active" : ""}>
            {t.admin.tabs[id]}
          </Link>
        ))}
      </nav>

      {tab === "posts" && <AdminPosts />}
      {tab === "tags" && <AdminTags />}
      {tab === "members" && (
        <div className="admin-block">
          <p className="dim" style={{ fontSize: "0.9rem" }}>
            {t.members.intro} {t.members.ownerNoteBefore} (<code>{OWNER_ID}</code>) {t.members.ownerNoteAfter}
          </p>
          <MembersManager initial={listUsers()} ownerId={OWNER_ID} />
        </div>
      )}
      {tab === "data" && <ResetData />}
    </main>
  );
}
