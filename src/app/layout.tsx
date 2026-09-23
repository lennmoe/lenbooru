import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { I18nProvider } from "@/components/I18nProvider";
import { getLang, getT } from "@/lib/i18n/server";
import "./globals.css";

// Also what Discord shows when the home link is pasted (its bot lands on /login).
const OG_IMAGE = { url: "/eden.png", width: 1024, height: 640 };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  const description = t.meta.description;
  return {
    metadataBase: new URL(process.env.AUTH_URL?.trim() || "http://localhost:3000"),
    title: "lenbooru",
    description,
    openGraph: {
      type: "website",
      siteName: "lenbooru",
      title: "lenbooru",
      description,
      url: "/",
      locale: t.locale.replace("-", "_"),
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: "lenbooru",
      description,
      images: [OG_IMAGE],
    },
    // the site has its own dark mode: tell Dark Reader not to restyle it (its injected
    // attributes also cause hydration mismatch warnings)
    other: { "darkreader-lock": "true" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0e0f13" },
    { media: "(prefers-color-scheme: light)", color: "#f4f5f8" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // explicit choice from ThemeToggle; absent = follow the OS (handled in CSS)
  const saved = (await cookies()).get("theme")?.value;
  const theme = saved === "light" || saved === "dark" ? saved : undefined;
  // safe mode (SafeModeToggle): set on the server so images never flash unblurred
  const safe = (await cookies()).get("safe")?.value === "1";
  const lang = await getLang();

  return (
    // suppressHydrationWarning: browser extensions (Dark Reader, etc.) add
    // attributes to <html>/<body> before React hydrates
    <html lang={lang} data-theme={theme} data-safe={safe ? "" : undefined} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <I18nProvider lang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
