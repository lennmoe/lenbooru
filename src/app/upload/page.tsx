import Link from "next/link";
import { redirect } from "next/navigation";
import { currentRole } from "@/lib/session";
import { canUpload } from "@/lib/perms";
import UploadClient from "@/components/UploadClient";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  if (!canUpload(await currentRole())) redirect("/");

  return (
    <main>
      <Link href="/" className="back-link">
        ← Galerie
      </Link>
      <UploadClient />
    </main>
  );
}
