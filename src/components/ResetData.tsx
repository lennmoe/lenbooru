"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "./I18nProvider";

export default function ResetData() {
  const router = useRouter();
  const t = useT();
  const [confirm, setConfirm] = useState("");
  const [members, setMembers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (confirm !== "RESET" || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm, members }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || t.common.error(res.status) });
        return;
      }
      setMsg({
        ok: true,
        text: t.reset.result(data.posts, members ? data.members : null),
      });
      setConfirm("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="danger-zone">
      <h2>{t.reset.title}</h2>
      <p>
        {t.reset.descBefore} <strong>{t.reset.descStrong}</strong> {t.reset.descAfter}
      </p>
      <form onSubmit={run}>
        <label className="check">
          <input
            type="checkbox"
            checked={members}
            onChange={(e) => setMembers(e.target.checked)}
          />
          {t.reset.alsoMembers}
        </label>
        <div className="field">
          <label htmlFor="reset-confirm">
            {t.reset.typeBefore} <code>RESET</code> {t.reset.typeAfter}
          </label>
          <input
            id="reset-confirm"
            type="text"
            autoComplete="off"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <button
          className="btn btn-danger"
          type="submit"
          disabled={confirm !== "RESET" || busy}
        >
          {busy ? t.reset.running : t.reset.button}
        </button>
      </form>
      {msg && <div className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}
    </section>
  );
}
