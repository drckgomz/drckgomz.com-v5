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
  const [count, setCount] = React.useState(0);
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const load = React.useCallback(async (p: number) => {
  const offset = (p - 1) * PAGE_SIZE;
  const res = await fetch(`/api/home/projects?limit=${PAGE_SIZE}&offset=${offset}`, {
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));

  console.log("[HomeGrid] projects payload", json); // <- TEMP

  setItems(Array.isArray(json?.items) ? json.items : []);
  setCount(
    Number.isFinite(json?.count)
      ? Number(json.count)
      : Array.isArray(json?.items)
      ? json.items.length
      : 0
  );
}, []);


  React.useEffect(() => { load(page); }, [page, load]);

  return (
    <div className="w-full">
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
        {count > PAGE_SIZE && page < totalPages && (
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-6 py-2 rounded-md ring-1 ring-white/20 hover:bg-white/10"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
