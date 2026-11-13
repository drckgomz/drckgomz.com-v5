"use client";

import * as React from "react";

export function useMediaOrder(opts: { slug?: string; notify?: (msg: string) => void }) {
  const { slug, notify } = opts;
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = React.useRef<Promise<void>>(Promise.resolve());
  const generation = React.useRef(0);
  const [status, setStatus] = React.useState("");

  const queueSave = React.useCallback((ordered: { id: string }[]) => {
    if (!slug) return;
    const version = ++generation.current;
    const orderedIds = ordered.map(item => item.id);
    if (timer.current) clearTimeout(timer.current);
    setStatus("Media order pending…");
    timer.current = setTimeout(() => {
      // Serialize local requests so an earlier response cannot reorder a later save.
      chain.current = chain.current.catch(() => {}).then(async () => {
        if (version !== generation.current) return;
        const res = await fetch(`/api/admin/posts/${encodeURIComponent(slug)}/media/reorder`, {
          method: "PATCH", headers: { "content-type": "application/json" },
          body: JSON.stringify({ order: orderedIds }),
        });
        if (!res.ok) throw new Error("Media order was not saved. Reload the media list before retrying.");
        if (version === generation.current) setStatus("Media order saved.");
      }).catch(() => {
        if (version === generation.current) {
          const message = "Media order was not saved. Reload the media list before retrying.";
          setStatus(message); notify?.(message);
        }
      });
    }, 350);
  }, [slug, notify]);

  React.useEffect(() => () => {
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
  }, [slug]);
  return { queueSave, status };
}
