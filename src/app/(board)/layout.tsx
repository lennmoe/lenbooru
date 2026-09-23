import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canManageUsers, canUpload } from "@/lib/perms";
import { getT } from "@/lib/i18n/server";
import LangToggle from "@/components/LangToggle";
import ThemeToggle from "@/components/ThemeToggle";
import SafeModeToggle from "@/components/SafeModeToggle";
import UserMenu from "@/components/UserMenu";
import TagSearch from "@/components/TagSearch";

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
        <Suspense
          fallback={
            <form action="/" method="get" className="tag-search">
              <input type="search" name="tags" placeholder={t.header.searchPlaceholder} />
            </form>
          }
        >
          <TagSearch />
        </Suspense>

        {canUpload(role) && (
          <Link href="/upload" className="btn btn-accent">
            {t.header.upload}
          </Link>
        )}
        <Link href="/chat" className="btn">
          {t.header.chat}
        </Link>
        {canManageUsers(role) && (
          <Link href="/admin" className="btn">
            {t.header.admin}
          </Link>
        )}

        <SafeModeToggle />
        <LangToggle />
        <ThemeToggle />

        <UserMenu name={user.name || "?"} image={user.image ?? null} role={role} />
      </header>
      {children}
    </>
  );
}
