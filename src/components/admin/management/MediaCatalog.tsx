"use client";

import { MediaMetadataLoader } from "./MediaMetadataEditor";
import { useState } from "react";
import Link from "next/link";
import type { CatalogMedia } from "@/lib/admin/media-catalog";

function MediaPreview({ item }: { item: CatalogMedia }) {
  const [failed, setFailed] = useState(false);
  if (!item.previewUrl || failed) return <p role={failed ? "status" : undefined} className="rounded border border-border p-4 text-sm text-muted-foreground">{failed ? "The protected preview could not load. Retry by reloading this page." : "Preview unavailable: source is missing or not supported by the protected preview adapter."}</p>;
  // Only a server-generated, owner-authorized same-origin preview URL reaches here.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={item.previewUrl} alt={item.title || item.caption || "Media preview; no alt text recorded"} onError={() => setFailed(true)} className="max-h-72 w-full rounded object-contain" />;
}

export default function MediaCatalog({ items, metadataEnabled = false }: { items: CatalogMedia[]; metadataEnabled?: boolean }) {
  const [view, setView] = useState<"grid" | "list">("grid");
  return <section className="space-y-4" aria-label="Media results">
    <div className="flex gap-2" role="group" aria-label="Media view">
      {(["grid", "list"] as const).map(mode => <button key={mode} type="button" aria-pressed={view === mode} onClick={() => setView(mode)} className="rounded border border-border px-4 py-3 capitalize">{mode} view</button>)}
    </div>
    {items.length === 0 ? <p>No media matches this search and filter.</p> : <ul className={view === "grid" ? "grid gap-4 lg:grid-cols-2" : "space-y-4"}>
      {items.map(item => <li key={item.id} className="min-w-0 space-y-3 rounded-xl border border-border p-4">
        <h2 className="break-words text-lg font-semibold">{item.title || "Untitled media"}</h2>
        <p className="text-sm text-muted-foreground">{item.type} · {item.postTitle}</p>
        <details><summary className="cursor-pointer py-2">Preview media</summary><MediaPreview item={item} /></details>
        <p className="break-words text-sm">Caption: {item.caption || "Not recorded"}</p>
        <p className="text-sm text-muted-foreground">Alt text: no dedicated metadata field is installed.</p>
        {metadataEnabled && <MediaMetadataLoader id={item.id} />}
        <Link href={`/admin/posts/${encodeURIComponent(item.postSlug)}`} className="inline-block underline">Open attached post</Link>
      </li>)}
    </ul>}
  </section>;
}
