"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import TagAutocomplete from "./TagAutocomplete";
import { useT } from "./I18nProvider";

/** Header search box with tag autocomplete (GET form to "/?tags=…"). */
export default function TagSearch() {
  const t = useT();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("tags") ?? "");

  // keep the box in sync when navigating between searches
  useEffect(() => setValue(params.get("tags") ?? ""), [params]);

  return (
    <form action="/" method="get" className="tag-search" role="search">
      <TagAutocomplete
        name="tags"
        value={value}
        onChange={setValue}
        placeholder={t.header.searchPlaceholder}
      />
    </form>
  );
}
