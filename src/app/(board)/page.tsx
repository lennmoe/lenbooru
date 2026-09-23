import Link from "next/link";
import { listPosts, countPosts, popularTags, POST_TYPES, PostType } from "@/lib/db";
import Gallery from "@/components/Gallery";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 60;
const TYPES = POST_TYPES;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; tags?: string }>;
}) {
  const sp = await searchParams;
  const t = await getT();
  const type = TYPES.includes(sp.type as PostType) ? (sp.type as PostType) : null;
  const tags = (sp.tags || "")
    .split(/[\s,]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

  const initial = listPosts({ type, tags, offset: 0, limit: PAGE_SIZE });
  const total = countPosts({ type, tags });
  const popular = popularTags(24);

  const mkHref = (ty: PostType | null) => {
    const q = new URLSearchParams();
    if (ty) q.set("type", ty);
    if (tags.length) q.set("tags", tags.join(" "));
    const s = q.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <main>
      <div className="chips">
        <Link href={mkHref(null)} className={`chip${!type ? " active" : ""}`}>
          {t.gallery.all} <span className="count">{!type ? total : ""}</span>
        </Link>
        {TYPES.map((type_) => (
          <Link
            key={type_}
            href={mkHref(type_)}
            className={`chip${type === type_ ? " active" : ""}`}
          >
            {t.gallery.types[type_]}
            {type === type_ && <span className="count">{total}</span>}
          </Link>
        ))}
      </div>

      {tags.length > 0 && (
        <div className="chips">
          <span style={{ color: "var(--text-dim)", alignSelf: "center" }}>
            {t.gallery.filter}
          </span>
          {tags.map((tag) => {
            const rest = tags.filter((x) => x !== tag);
            const q = new URLSearchParams();
            if (type) q.set("type", type);
            if (rest.length) q.set("tags", rest.join(" "));
            const s = q.toString();
            return (
              <Link
                key={tag}
                href={s ? `/?${s}` : "/"}
                className="chip active"
                title={t.gallery.removeTag}
              >
                {tag} ✕
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
