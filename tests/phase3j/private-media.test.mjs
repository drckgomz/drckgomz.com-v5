import { describe, it } from "node:test";
import assert from "node:assert/strict";
import privateMedia from "../../.artifacts/phase3j/private-media.cjs";
import contentServer from "../../.artifacts/phase3j/content-server.cjs";
const {
  canReadProtectedMedia,
  isPrivateJournalKey,
  makePrivateJournalKey,
  privateMediaUrl,
  privateJournalStorageConfig,
  visibleJournalMediaUrl,
} = privateMedia;
const { preparePrivateBlogContent } = contentServer;

const mediaId = "2f0338c1-ec1a-4fd9-a35a-8e195d9327d0";
const postId = "post_123";
const key = `journal-private/${postId}/${mediaId}.webp`;
const publicPost = { status: "public" };
const privatePost = { status: "private" };
const owner = { id: "owner", enabled: true, is_banned: false, role: "owner", is_owner: true };
const approved = { id: "approved", enabled: true, is_banned: false, role: "user", can_view_private: true };
const registered = { id: "registered", enabled: true, is_banned: false, role: "user", can_view_private: false };
const revoked = { ...approved, can_view_private: false };
const blocked = { ...approved, enabled: false };

describe("protected journal media authorization", () => {
  it("allows anonymous access only while the current post is public", () => {
    assert.equal(canReadProtectedMedia(publicPost, null), true);
    assert.equal(canReadProtectedMedia(privatePost, null), false);
  });
  it("denies ordinary registered accounts and permits approved viewers and owners", () => {
    assert.equal(canReadProtectedMedia(privatePost, registered), false);
    assert.equal(canReadProtectedMedia(privatePost, approved), true);
    assert.equal(canReadProtectedMedia(privatePost, owner), true);
  });
  it("applies revoked, blocked, and unpublished state on the next request", () => {
    assert.equal(canReadProtectedMedia(privatePost, revoked), false);
    assert.equal(canReadProtectedMedia(privatePost, blocked), false);
    assert.equal(canReadProtectedMedia({ status: "draft" }, approved), false);
    assert.equal(canReadProtectedMedia({ status: "private", deleted_at: new Date() }, owner), false);
  });
  it("allows owners to inspect archived content under the existing policy", () => {
    assert.equal(canReadProtectedMedia({ status: "archived" }, owner), true);
  });
});

describe("private journal object references", () => {
  it("creates exact post-bound and media-bound object keys", () => {
    assert.equal(makePrivateJournalKey(postId, mediaId, "webp"), key);
    assert.equal(isPrivateJournalKey(key, postId, mediaId), true);
    assert.equal(privateMediaUrl(mediaId), `/api/private/journal-media/${mediaId}`);
  });
  it("requires a distinct, well-formed private bucket and region", () => {
    assert.deepEqual(privateJournalStorageConfig({ S3_PRIVATE_JOURNAL_BUCKET: "journal-private-bucket", S3_BUCKET: "portfolio-public-bucket", AWS_REGION: "us-east-2" }), {
      bucket: "journal-private-bucket", region: "us-east-2", prefix: "journal-private",
    });
    assert.equal(privateJournalStorageConfig({ S3_PRIVATE_JOURNAL_BUCKET: "same-bucket", S3_BUCKET: "same-bucket", AWS_REGION: "us-east-2" }), null);
    assert.equal(privateJournalStorageConfig({ S3_PRIVATE_JOURNAL_BUCKET: "bucket", S3_BUCKET: "other", AWS_REGION: "" }), null);
  });
  it("rejects traversal, encoding, direct URLs, extensions, and identity mismatches", () => {
    for (const invalid of [
      `journal-private/${postId}/../${mediaId}.webp`,
      `journal-private/${postId}/%2e%2e/${mediaId}.webp`,
      `https://bucket.example/${key}`,
      `journal-private/${postId}/${mediaId}.svg`,
      `journal-private/other/${mediaId}.webp`,
    ]) assert.equal(isPrivateJournalKey(invalid, postId, mediaId), false, invalid);
    assert.equal(makePrivateJournalKey("../post", mediaId, "webp"), null);
  });
  it("routes private media privately and quarantines legacy URLs on nonpublic posts", () => {
    const normalize = (value) => value ? `https://public.example/${value}` : null;
    assert.equal(visibleJournalMediaUrl({ id: mediaId, postId, url: key }, "private", normalize), privateMediaUrl(mediaId));
    assert.equal(visibleJournalMediaUrl({ id: mediaId, postId, url: "old-public.jpg" }, "private", normalize), null);
    assert.equal(visibleJournalMediaUrl({ id: mediaId, postId, url: "old-public.jpg" }, "public", normalize), "https://public.example/old-public.jpg");
    assert.equal(visibleJournalMediaUrl({ id: mediaId, postId, url: `journal-private/${postId}/wrong.webp` }, "public", normalize), null);
  });
});

describe("private rich content", () => {
  it("retains only protected image sources and strips third-party auto-loads", () => {
    const safeUrl = privateMediaUrl(mediaId);
    const html = preparePrivateBlogContent(
      `<p>Text</p><img src="https://public.example/old.jpg"><img src="${safeUrl}"><iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe><video src="https://public.example/movie.mp4"></video>`,
      [],
    );
    assert.equal(html.includes("https://public.example/old.jpg"), false);
    assert.equal(html.includes("youtube.com/embed"), false);
    assert.equal(html.includes("public.example/movie"), false);
    assert.equal(html.includes(safeUrl), true);
  });
});
