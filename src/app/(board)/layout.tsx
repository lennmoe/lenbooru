import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canManageUsers, canUpload } from "@/lib/perms";
import { getT } from "@/lib/i18n/server";
import LangToggle from "@/components/LangToggle";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";

/**
 * Layout de toutes les pages réservées aux membres. Le rôle est relu en base à
 * chaque requête (callback jwt de `src/auth.ts`), donc un ajout/retrait via
 * /members ou le bot Discord prend effet immédiatement — le middleware, lui, ne
 * vérifie que la connexion.
 */
export default async function BoardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  const role = user.role;
  if (!role) redirect("/denied");
  const t = await getT();

  return (
    <>
      <header className="site-header">
        <Link href="/" className="brand">
          lenbooru
        </Link>
        <form action="/" method="get">
          <input
            type="search"
            name="tags"
            placeholder={t.header.searchPlaceholder}
            autoComplete="off"
          />
        </form>

        {canUpload(role) && (
          <Link href="/upload" className="btn btn-accent">
            {t.header.upload}
          </Link>
        )}
        {canManageUsers(role) && (
          <Link href="/members" className="btn">
            {t.header.members}
          </Link>
        )}

        <LangToggle />
        <ThemeToggle />

        <UserMenu name={user.name || "?"} image={user.image ?? null} role={role} />
      </header>
      {children}
    </>
  );
}
