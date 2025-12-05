// frontend/src/features/projects/lib/thumbs.ts
import type { ProjectMedia } from "@/components/home/sections/project/lib/types";

export function topProjectThumb(
  media?: ProjectMedia[] | null,
  fallback = "/logo192.png"
) {
  if (!media || media.length === 0) return fallback;

  let best: ProjectMedia | undefined;
  for (const m of media) {
    if (m.type !== "image" || !m.url) continue;
    if (!best || (m.idx ?? 0) < (best.idx ?? 0)) best = m;
  }
  return best?.url || fallback;
}

