// frontend/src/features/home/components/HomeGrid.tsx
"use client";
import * as React from "react";
import ProjectTile from "@/components/home/sections/project/ProjectTile";

const PAGE_SIZE = 6;

type Project = {
  id: string;
  title: string;
  slug: string | null;
  excerpt: string | null;
  color: string | null;
  image_url: string | null;          // hero/fallback image
  display_thumb_url?: string | null; // <- computed by API from top media
};

export default function HomeGrid() {
  const [page, setPage] = React.useState(1);
  const [items, setItems] = React.useState<Project[]>([]);
  const [hasMore, setHasMore] = React.useState(false);

  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    const controller = new AbortController();
    setError(false);
    async function load() {
      try {
        const offset = (page - 1) * PAGE_SIZE;
        const res = await fetch(`/api/home/projects?limit=${PAGE_SIZE}&offset=${offset}`, {
          cache: "no-store", signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to load projects");
        const json = await res.json();
        if (controller.signal.aborted) return;
        setItems(Array.isArray(json?.items) ? json.items : []);
        setHasMore(json?.hasMore === true);
      } catch {
        if (controller.signal.aborted) return;
        setItems([]);
        setHasMore(false);
        setError(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [page]);

  return (
    <div className="w-full">
      {error && <p role="status">Projects could not be loaded. Please try again later.</p>}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        {items.map((p) => (
          <ProjectTile key={p.id} project={p} />
        ))}
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        {page > 1 && (
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-6 py-2 rounded-md ring-1 ring-white/20 hover:bg-white/10"
          >
            ← Prev
          </button>
        )}
        {hasMore && (
          <button
            onClick={() => setPage((p) => p + 1)}
            className="px-6 py-2 rounded-md ring-1 ring-white/20 hover:bg-white/10"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
