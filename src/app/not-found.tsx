import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <p className="empty">
        Introuvable. <Link href="/">Retour à la galerie →</Link>
      </p>
    </main>
  );
}
