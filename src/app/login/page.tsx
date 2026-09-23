import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DiscordSignInButton } from "@/components/AuthButtons";
import DiscordLogo from "@/components/DiscordLogo";
import LangToggle from "@/components/LangToggle";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.role) redirect("/");
  if (session?.user && !session.user.role) redirect("/denied");

  const t = await getT();
  const invite = process.env.DISCORD_INVITE_URL?.trim();

  return (
    <main className="center-card">
      <div className="corner-tools">
        <LangToggle />
      </div>
      <div className="login-box">
        <div className="brand" style={{ fontSize: "1.6rem" }}>
          lenbooru
        </div>
        <p className="login-desc">{t.auth.loginDesc}</p>
        <DiscordSignInButton />
        {invite ? (
          <a
            className="btn btn-discord-outline"
            href={invite}
            target="_blank"
            rel="noopener noreferrer"
            style={{ width: "100%" }}
          >
            <DiscordLogo size={18} />
            {t.auth.joinServer}
          </a>
        ) : (
          <span
            className="btn btn-discord-outline"
            aria-disabled="true"
            title={t.auth.inviteMissing}
            style={{ width: "100%", opacity: 0.5, cursor: "not-allowed" }}
          >
            <DiscordLogo size={18} />
            {t.auth.joinServer}
          </span>
        )}
      </div>
    </main>
  );
}
