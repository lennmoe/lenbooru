import Link from "next/link";
import { redirect } from "next/navigation";
import { currentRole } from "@/lib/session";
import { canManageUsers } from "@/lib/perms";
import { listUsers, OWNER_ID } from "@/lib/users";
import MembersManager from "@/components/MembersManager";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const role = await currentRole();
  if (!canManageUsers(role)) redirect("/");

  return (
    <main>
      <Link href="/" className="back-link">
        ← Galerie
      </Link>
      <h1 style={{ fontSize: "1.2rem" }}>Membres</h1>
      <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>
        Ajoute des membres par leur ID Discord et choisis leur niveau d&apos;accès.
        Ton compte (<code>{OWNER_ID}</code>) est propriétaire en permanence.
      </p>
      <MembersManager initial={listUsers()} ownerId={OWNER_ID} />
    </main>
  );
}
