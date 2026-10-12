import { Suspense } from "react";
import TagSearch from "./TagSearch";
import { SearchIcon } from "./Icons";
import { getT } from "@/lib/i18n/server";

/** "Search" block at the top of the gallery and post sidebars. */
export default async function SidebarSearch() {
  const t = await getT();
  return (
    <section className="side-section">
      <h2>{t.gallery.search}</h2>
      <Suspense
        fallback={
          <form action="/" method="get" className="tag-search">
            <input type="search" name="tags" placeholder={t.header.searchPlaceholder} />
            <button type="submit" aria-label={t.gallery.go}>
              <SearchIcon />
            </button>
          </form>
        }
      >
        <TagSearch />
      </Suspense>
    </section>
  );
}
