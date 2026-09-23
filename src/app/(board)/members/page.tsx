import Link from "next/link";
import { redirect } from "next/navigation";
import { currentRole } from "@/lib/session";
import { canManageUsers } from "@/lib/perms";
import { listUsers, OWNER_ID } from "@/lib/users";
import MembersManager from "@/components/MembersManager";
import ResetData from "@/components/ResetData";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const role = await currentRole();
  if (!canManageUsers(role)) redirect("/");
  const t = await getT();

  return (
    <main>
      <Link href="/" className="back-link">
        ← {t.common.gallery}
      </Link>
      <h1 style={{ fontSize: "1.2rem" }}>{t.members.title}</h1>
      <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>
        {t.members.intro} {t.members.ownerNoteBefore} (<code>{OWNER_ID}</code>){" "}
        {t.members.ownerNoteAfter}
      </p>
      <MembersManager initial={listUsers()} ownerId={OWNER_ID} />
      <ResetData />
    </main>
  );
}
