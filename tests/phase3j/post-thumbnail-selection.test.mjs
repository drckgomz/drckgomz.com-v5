import assert from "node:assert/strict";
import test from "node:test";
import { selectPostThumbnail } from "../../src/components/admin/posts/thumbnail.ts";

const getYouTubeVideoId = (value) => {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return url.pathname.slice(1) || undefined;
    if (["youtube.com", "www.youtube.com"].includes(url.hostname)) return url.searchParams.get("v") ?? undefined;
  } catch { /* invalid embed */ }
  return undefined;
};

test("a historical image remains the post thumbnail even when an earlier video is attached", () => {
  assert.equal(selectPostThumbnail([
    { type: "youtube", url: "https://youtu.be/abcdefghijk", idx: 0 },
    { type: "image", url: "/api/dev/legacy-media-preview/legacy-post-media-28", idx: 1 },
  ], null, getYouTubeVideoId), "/api/dev/legacy-media-preview/legacy-post-media-28");
});

test("a valid YouTube thumbnail or saved fallback is used when no image is attached", () => {
  assert.equal(selectPostThumbnail([{ type: "youtube", url: "https://youtu.be/abcdefghijk", idx: 0 }], null, getYouTubeVideoId),
    "https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg");
  assert.equal(selectPostThumbnail([{ type: "instagram", url: "https://instagram.com/p/sample/" }], "/local/fallback.jpg", getYouTubeVideoId),
    "/local/fallback.jpg");
});
