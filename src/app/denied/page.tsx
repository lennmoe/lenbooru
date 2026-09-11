import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";

export const dynamic = "force-dynamic";

export default async function DeniedPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role) redirect("/");

  return (
    <main className="center-card">
      <div className="login-box">
        <h1 style={{ margin: 0 }}>Accès refusé</h1>
        <p style={{ color: "var(--text-dim)" }}>
          Ton compte Discord <strong>{session.user.name}</strong> n&apos;est pas
          sur la liste blanche.
        </p>
        <p style={{ color: "var(--text-dim)" }}>
          Donne cet identifiant au propriétaire pour être ajouté&nbsp;:
        </p>
        <code className="id-pill">{session.user.discordId}</code>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button className="btn" type="submit" style={{ width: "100%" }}>
            Se déconnecter
          </button>
        </form>
      </div>
    </main>
  );
}
