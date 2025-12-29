"use client";

import * as React from "react";

function slugDraft(v: string) {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function slugFinalize(v: string) {
  return slugDraft(v).replace(/^-+|-+$/g, "");
}

export function useSlugInput(slug: string, setSlug: (s: any) => void) {
  const onChange = React.useCallback((v: string) => setSlug(slugDraft(v)), [setSlug]);
  const onBlur = React.useCallback(() => setSlug((s: string) => slugFinalize(s)), [setSlug]);

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
