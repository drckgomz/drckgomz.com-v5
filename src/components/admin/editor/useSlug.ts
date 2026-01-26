// src/components/admin/editor/useSlug.ts
"use client";

import * as React from "react";

export const slugFinalize = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)+/g, "");

export const slugDraft = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\- ]+/g, "")
    .replace(/ +/g, "-")
    .replace(/-+/g, "-");

export function useSlugInput(
  slug: string,
  setSlug: React.Dispatch<React.SetStateAction<string>>
) {
  const onChange = React.useCallback((v: string) => setSlug(slugDraft(v)), [setSlug]);

  const onBlur = React.useCallback(() => setSlug((s) => slugFinalize(s)), [setSlug]);

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        const target = e.currentTarget;
        const start = target.selectionStart ?? slug.length;
        const end = target.selectionEnd ?? slug.length;
        const next = slugDraft(slug.slice(0, start) + "-" + slug.slice(end));
        setSlug(next);
        requestAnimationFrame(() => target.setSelectionRange(start + 1, start + 1));
      }
    },
    [slug, setSlug]
  );

  return { onChange, onBlur, onKeyDown };
}
