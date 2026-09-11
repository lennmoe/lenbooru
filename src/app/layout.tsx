import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { canManageUsers, canUpload } from "@/lib/perms";
import "./globals.css";

export const metadata: Metadata = {
  title: "lenbooru",
  description: "Image board perso — images, vidéos, doujins",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e0f13",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user ?? null;
  const role = user?.role ?? null;

  return (
    <html lang="fr">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            lenbooru
          </Link>
          <form action="/" method="get">
            <input
              type="search"
              name="tags"
              placeholder="Rechercher des tags (ex: bikini school)"
              autoComplete="off"
            />
          </form>

          {canUpload(role) && (
            <Link href="/upload" className="btn btn-accent">
              + Upload
            </Link>
          )}
          {canManageUsers(role) && (
            <Link href="/members" className="btn">
              Membres
            </Link>
          )}

          {user && (
            <div className="user-chip">
              {user.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt="" width={22} height={22} />
              )}
              <span>{user.name}</span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button className="linklike" type="submit">
                  déconnexion
                </button>
              </form>
            </div>
          )}
        </header>
        {children}
      </body>
    </html>
  );
}
