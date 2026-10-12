import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canManageUsers, canUpload } from "@/lib/perms";
import { getT } from "@/lib/i18n/server";
import LangToggle from "@/components/LangToggle";
import ThemeToggle from "@/components/ThemeToggle";
import SafeModeToggle from "@/components/SafeModeToggle";
import UserMenu from "@/components/UserMenu";
import NavLinks from "@/components/NavLinks";

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

  const nav = [
    { href: "/", label: t.header.posts },
    ...(canUpload(role) ? [{ href: "/upload", label: t.header.upload }] : []),
    { href: "/chat", label: t.header.chat },
    ...(canManageUsers(role) ? [{ href: "/admin", label: t.header.admin }] : []),
  ];

  return (
    <>
      <header className="site-header">
        <Link href="/" className="brand">
          lenbooru
        </Link>
        <NavLinks items={nav} />

        <div className="header-tools">
          <SafeModeToggle />
          <LangToggle />
          <ThemeToggle />
          <UserMenu name={user.name || "?"} image={user.image ?? null} role={role} />
        </div>
      </header>
      {children}
    </>
  );
}
