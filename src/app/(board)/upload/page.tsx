import Link from "next/link";
import { redirect } from "next/navigation";
import { currentRole } from "@/lib/session";
import { canUpload } from "@/lib/perms";
import UploadClient from "@/components/UploadClient";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  if (!canUpload(await currentRole())) redirect("/");
  const t = await getT();

  return (
    <main>
      <Link href="/" className="back-link">
        ← {t.common.gallery}
      </Link>
      <UploadClient />
    </main>
  );
}
