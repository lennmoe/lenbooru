import Link from "next/link";
import { listPosts, countPosts, popularTags, PostType } from "@/lib/db";
import Gallery from "@/components/Gallery";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 60;
const TYPES: PostType[] = ["image", "video", "doujin"];
const TYPE_LABEL: Record<string, string> = {
  image: "Images",
  video: "Vidéos",
  doujin: "Doujins",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; tags?: string }>;
}) {
  const sp = await searchParams;
  const type = TYPES.includes(sp.type as PostType) ? (sp.type as PostType) : null;
  const tags = (sp.tags || "")
    .split(/[\s,]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const initial = listPosts({ type, tags, offset: 0, limit: PAGE_SIZE });
  const total = countPosts({ type, tags });
  const popular = popularTags(24);

  const mkHref = (t: PostType | null) => {
    const q = new URLSearchParams();
    if (t) q.set("type", t);
    if (tags.length) q.set("tags", tags.join(" "));
    const s = q.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <main>
      <div className="chips">
        <Link href={mkHref(null)} className={`chip${!type ? " active" : ""}`}>
          Tout <span className="count">{!type ? total : ""}</span>
        </Link>
        {TYPES.map((t) => (
          <Link
            key={t}
            href={mkHref(t)}
            className={`chip${type === t ? " active" : ""}`}
          >
            {TYPE_LABEL[t]}
            {type === t && <span className="count">{total}</span>}
          </Link>
        ))}
      </div>

      {tags.length > 0 && (
        <div className="chips">
          <span style={{ color: "var(--text-dim)", alignSelf: "center" }}>
            Filtre&nbsp;:
          </span>
          {tags.map((t) => {
            const rest = tags.filter((x) => x !== t);
            const q = new URLSearchParams();
            if (type) q.set("type", type);
            if (rest.length) q.set("tags", rest.join(" "));
            const s = q.toString();
            return (
              <Link
                key={t}
                href={s ? `/?${s}` : "/"}
                className="chip active"
                title="Retirer ce tag"
              >
                {t} ✕
              </Link>
            );
          })}
        </div>
      )}

      {tags.length === 0 && popular.length > 0 && (
        <div className="chips">
          {popular.map((p) => (
            <Link key={p.name} href={`/?tags=${encodeURIComponent(p.name)}`} className="chip">
              {p.name}
              <span className="count">{p.count}</span>
            </Link>
          ))}
        </div>
      )}

      <Gallery
        key={`${type}|${tags.join(",")}`}
        initial={initial}
        type={type}
        tags={tags}
        pageSize={PAGE_SIZE}
      />
    </main>
  );
}
