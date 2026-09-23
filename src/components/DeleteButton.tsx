"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "./I18nProvider";

export default function DeleteButton({ id }: { id: number }) {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm(t.post.deleteConfirm)) return;
    setBusy(true);
    const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setBusy(false);
      alert(t.post.deleteFailed);
    }
  }

  return (
    <button className="btn btn-danger" onClick={onDelete} disabled={busy}>
      {busy ? t.post.deleting : t.post.delete}
    </button>
  );
}
