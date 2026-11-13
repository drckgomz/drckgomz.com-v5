/** Shared runtime normalization keeps admin hydration and public media policies aligned. */
export { normalizeMedia, sortMedia, getYouTubeVideoId } from "@/lib/blog/media";
export type { NormalizedMedia } from "@/lib/blog/media";
export type MediaType = "image" | "youtube" | "instagram" | string;
