"use client";

import { RATINGS, type Rating } from "@/lib/tags";
import { useT } from "./I18nProvider";

/** General / Sensitive / Questionable / Explicit, as a row of toggle buttons. */
export default function RatingPicker({
  value,
  onChange,
}: {
  value: Rating | "";
  onChange: (r: Rating) => void;
}) {
  const t = useT();
  return (
    <div className="rating-switch" role="radiogroup" aria-label={t.fields.rating}>
      {RATINGS.map((r) => (
        <button
          key={r}
          type="button"
          role="radio"
          aria-checked={value === r}
          className={`rating-${r}${value === r ? " active" : ""}`}
          onClick={() => onChange(r)}
        >
          {t.ratings[r]}
        </button>
      ))}
    </div>
  );
}
