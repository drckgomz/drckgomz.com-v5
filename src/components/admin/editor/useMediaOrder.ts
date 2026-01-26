// src/components/admin/editor/useMediaOrder.ts
"use client";

import * as React from "react";

export function useMediaOrder(opts: { slug?: string; notify?: (msg: string) => void }) {
  const { slug, notify } = opts;
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = React.useCallback(
    async (orderedIds: string[]) => {
      if (!slug) return;

      const res = await fetch(`/api/admin/posts/${encodeURIComponent(slug)}/media/reorder`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ order: orderedIds }), // ✅ server supports this now
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Failed to save media order");
      }
    },
    [slug]
  );

  const queueSave = React.useCallback(
    (ordered: { id: string }[]) => {
      if (typeof window === "undefined") return;
      if (!slug) return;

      const orderedIds = (ordered ?? []).map((o) => o?.id).filter(Boolean) as string[];

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        try {
          await save(orderedIds);
        } catch (err) {
          (notify ?? ((m: string) => console.warn(m)))("Failed to save media order");
          console.warn(err);
        }
      }, 350);
    },
    [slug, save, notify]
  );

  return { queueSave };
}
