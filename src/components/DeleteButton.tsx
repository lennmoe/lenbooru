"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteButton({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm("Supprimer ce post et ses fichiers ?")) return;
    setBusy(true);
    const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setBusy(false);
      alert("Échec de la suppression");
    }
  }

  return (
    <button className="btn btn-danger" onClick={onDelete} disabled={busy}>
      {busy ? "Suppression…" : "Supprimer"}
    </button>
  );
}
