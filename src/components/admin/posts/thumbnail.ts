type ThumbnailMedia = { type?: string | null; url?: string | null; idx?: number | null };

/** Prefer an attached image over an earlier video embed when choosing a post card thumbnail. */
export function selectPostThumbnail(
  media: ThumbnailMedia[] | null | undefined,
  fallback: string | null | undefined,
  getYouTubeVideoId: (url: string) => string | undefined,
): string | null {
  const ordered = [...(media ?? [])].sort((a, b) => (a.idx ?? Number.MAX_SAFE_INTEGER) - (b.idx ?? Number.MAX_SAFE_INTEGER));
  const image = ordered.find((item) => item.type?.toLowerCase() === "image" && typeof item.url === "string" && item.url.length > 0);
  if (image?.url) return image.url;

  const youtube = ordered.find((item) => item.type?.toLowerCase() === "youtube" && typeof item.url === "string" && item.url.length > 0);
  if (youtube?.url) {
    const id = getYouTubeVideoId(youtube.url);
    if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }
  return fallback || null;
}
