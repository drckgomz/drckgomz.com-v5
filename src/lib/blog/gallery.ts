import { normalizeMaybeS3Url } from "./media";
import { getYouTubeId, isInstagramUrl, type MediaItem } from "./render";

/** Gallery and inline media share the same allowed formats and URL boundary. */
export function normalizeGalleryMedia(input: unknown): MediaItem[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((value, index) => {
    if (!value || typeof value !== "object" || typeof value.url !== "string") return [];
    const type = value.type;
    if (type !== "image" && type !== "youtube" && type !== "instagram") return [];
    const url = normalizeMaybeS3Url(value.url);
    if (!url || (type === "youtube" && !getYouTubeId(url)) || (type === "instagram" && !isInstagramUrl(url))) return [];
    return [{ id: `carousel-${index}`, type, url,
      caption: typeof value.caption === "string" ? value.caption : null,
      title: typeof value.title === "string" ? value.title : null }];
  });
}
