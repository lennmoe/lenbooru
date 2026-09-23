"use client";

import type { TagFields } from "@/lib/tags";
import TagAutocomplete from "./TagAutocomplete";
import { useT } from "./I18nProvider";

/**
 * Parodies / Characters / Tags fields of the upload and edit forms. The first
 * two only suggest tags of their category and don't need any prefix; they are
 * merged back into one tag list with joinTagFields().
 */
export default function TagFieldsEditor({
  value,
  onChange,
}: {
  value: TagFields;
  onChange: (next: TagFields) => void;
}) {
  const t = useT();
  const set = (key: keyof TagFields) => (v: string) => onChange({ ...value, [key]: v });

  return (
    <>
      <div className="field">
        <label htmlFor="parodies" className="tag-copyright">
          {t.fields.parodies}
        </label>
        <TagAutocomplete
          id="parodies"
          category="copyright"
          value={value.parodies}
          onChange={set("parodies")}
          placeholder={t.fields.parodiesPlaceholder}
        />
      </div>

      <div className="field">
        <label htmlFor="characters" className="tag-character">
          {t.fields.characters}
        </label>
        <TagAutocomplete
          id="characters"
          category="character"
          value={value.characters}
          onChange={set("characters")}
          placeholder={t.fields.charactersPlaceholder}
        />
      </div>

      <div className="field">
        <label htmlFor="tags">{t.upload.commonTags}</label>
        <TagAutocomplete
          as="textarea"
          id="tags"
          rows={2}
          value={value.tags}
          onChange={set("tags")}
          placeholder="blonde_hair school_uniform artist:…"
        />
        <small className="field-hint">{t.tagPrefixHint}</small>
      </div>
    </>
  );
}
