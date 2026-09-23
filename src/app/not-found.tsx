import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getT();
  return (
    <main>
      <p className="empty">
        {t.notFound.text} <Link href="/">{t.notFound.back}</Link>
      </p>
    </main>
  );
}
