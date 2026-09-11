import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.role) redirect("/");
  if (session?.user && !session.user.role) redirect("/denied");

  return (
    <main className="center-card">
      <div className="login-box">
        <div className="brand" style={{ fontSize: "1.6rem" }}>
          lenbooru
        </div>
        <p style={{ color: "var(--text-dim)" }}>
          Accès privé. Connecte-toi avec Discord pour continuer.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("discord", { redirectTo: "/" });
          }}
        >
          <button className="btn btn-accent" type="submit" style={{ width: "100%" }}>
            Se connecter avec Discord
          </button>
        </form>
      </div>
    </main>
  );
}
