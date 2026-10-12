import Link from "next/link";
import { listPosts, searchResultTags, POST_TYPES, PostType } from "@/lib/db";
import Gallery from "@/components/Gallery";
import SidebarSearch from "@/components/SidebarSearch";
import { RATINGS, displayTag, fmtCount, parseSearch, type Rating } from "@/lib/tags";
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
  // "parody:naruto" searches for the tag "naruto"; "rating:e" filters by rating
  const { tags, rating } = parseSearch(sp.tags || "");

  const initial = listPosts({ type, tags, rating, offset: 0, limit: PAGE_SIZE });
  const sideTags = searchResultTags({ type, tags, rating }, 25);

  // search string as the box shows it: tags, then the rating filter
  const queryOf = (tg: string[], r: Rating | null) =>
    [...tg, ...(r ? [`rating:${r}`] : [])].join(" ");
  const query = queryOf(tags, rating);

  const href = (o: { type?: PostType | null; tags?: string[]; rating?: Rating | null }) => {
    const q = new URLSearchParams();
    const ty = o.type !== undefined ? o.type : type;
    const s = queryOf(o.tags ?? tags, o.rating !== undefined ? o.rating : rating);
    if (ty) q.set("type", ty);
    if (s) q.set("tags", s);
    const str = q.toString();
    return str ? `/?${str}` : "/";
  };

  return (
    <main className="board">
      <aside className="board-side">
        <SidebarSearch />

        <section className="side-section">
          <h2>{t.gallery.type}</h2>
          <ul className="side-list">
            {[null, ...TYPES].map((ty) => (
              <li key={ty ?? "all"}>
                <Link href={href({ type: ty })} className={type === ty ? "active" : undefined}>
                  {ty ? t.gallery.types[ty] : t.gallery.all}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="side-section">
          <h2>{t.gallery.rating}</h2>
          <ul className="side-list">
            {[null, ...RATINGS].map((r) => (
              <li key={r ?? "any"}>
                <Link
                  href={href({ rating: r })}
                  className={[rating === r ? "active" : "", r ? `rating-text rating-${r}` : ""]
                    .filter(Boolean)
                    .join(" ") || undefined}
                >
                  {r ? t.ratings[r] : t.gallery.anyRating}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {sideTags.length > 0 && (
          <section className="side-section">
            <h2>{t.gallery.tags}</h2>
            <ul className="side-tags">
              {sideTags.map((tag) => {
                const inSearch = tags.includes(tag.name);
                return (
                  <li key={tag.name}>
                    {inSearch ? (
                      <Link
                        href={href({ tags: tags.filter((x) => x !== tag.name) })}
                        className="side-tag-op"
                        title={t.gallery.removeTag}
                        aria-label={t.gallery.removeTag}
                      >
                        −
                      </Link>
                    ) : (
                      <Link
                        href={href({ tags: [...tags, tag.name] })}
                        className="side-tag-op"
                        title={t.gallery.addTag}
                        aria-label={t.gallery.addTag}
                      >
                        +
                      </Link>
                    )}
                    <Link
                      href={`/?tags=${encodeURIComponent(tag.name)}`}
                      className={`side-tag-name tag-${tag.category}`}
                    >
                      {displayTag(tag.name)}
                    </Link>
                    <span className="count">{fmtCount(tag.count)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </aside>

      <div className="board-main">
        <Gallery
          key={`${type}|${query}`}
          initial={initial}
          type={type}
          query={query}
          pageSize={PAGE_SIZE}
        />
      </div>
    </main>
  );
}
