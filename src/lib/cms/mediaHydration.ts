import { normalizeMedia, sortMedia, type NormalizedMedia } from "@/lib/blog/media";

/** A late catalog snapshot must not replace a newer upload/caption/order change. */
export function createMediaHydration() {
  let version = 0;
  let controller: AbortController | null = null;
  return {
    edited() { version++; },
    cancel() { version++; controller?.abort(); },
    async load(slug: string, apply: (media: NormalizedMedia[]) => void, fetcher: typeof fetch = fetch) {
      controller?.abort();
      const current = new AbortController(); controller = current;
      const sourceVersion = version;
      const response = await fetcher(`/api/admin/posts/${encodeURIComponent(slug)}/media`, { cache: "no-store", signal: current.signal });
      if (!response.ok) throw new Error("Unable to refresh media. Existing edits were retained.");
      const json: unknown = await response.json();
      const rows = Array.isArray(json) ? json : json && typeof json === "object" && "media" in json ? json.media : null;
      if (!Array.isArray(rows)) throw new Error("Invalid media response. Existing edits were retained.");
      if (!current.signal.aborted && sourceVersion === version) apply(sortMedia(normalizeMedia(rows)));
    },
  };
}
