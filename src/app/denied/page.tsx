import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/AuthButtons";
import DiscordLogo from "@/components/DiscordLogo";
import LangToggle from "@/components/LangToggle";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function DeniedPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role) redirect("/");

  const t = await getT();
  const invite = process.env.DISCORD_INVITE_URL?.trim();

  return (
    <main className="center-card">
      <div className="corner-tools">
        <LangToggle />
      </div>
      <div className="login-box">
        <h1 style={{ margin: 0 }}>{t.auth.deniedTitle}</h1>
        <p style={{ color: "var(--text-dim)" }}>
          {t.auth.deniedNotListedBefore} <strong>{session.user.name}</strong>{" "}
          {t.auth.deniedNotListedAfter}
        </p>
        <p style={{ color: "var(--text-dim)" }}>{t.auth.deniedGiveId}</p>
        <code className="id-pill">{session.user.discordId}</code>
        {invite && (
          <a
            className="btn btn-discord"
            href={invite}
            target="_blank"
            rel="noopener noreferrer"
            style={{ width: "100%" }}
          >
            <DiscordLogo size={18} />
            {t.auth.joinServer}
          </a>
        )}
        <SignOutButton style={{ width: "100%" }}>{t.auth.signOut}</SignOutButton>
      </div>
    </main>
  );
}
