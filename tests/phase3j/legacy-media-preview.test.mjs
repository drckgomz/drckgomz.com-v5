import assert from "node:assert/strict";
import test from "node:test";
import {
  legacyBlogImageMediaId,
  localLegacyBlogImagePreviewUrl,
  parseLegacyBlogImageReference,
} from "../../src/lib/blog/legacy-media-preview.ts";

const valid = "https://derickgomez-images.s3.us-east-1.amazonaws.com/blog-images/1747873139903-IMG_0765.jpeg";

test("accepts only the exact historical blog image S3 host and safe key shape", () => {
  assert.deepEqual(parseLegacyBlogImageReference(valid), {
    url: valid,
    key: "blog-images/1747873139903-IMG_0765.jpeg",
  });
  assert.equal(localLegacyBlogImagePreviewUrl("legacy-post-media-28", valid, { NODE_ENV: "development", LOCAL_PG_INTEGRATION: "1" }),
    "/api/dev/legacy-media-preview/legacy-post-media-28");
});

test("rejects alternate hosts, non-HTTPS URLs, query strings, traversal and encoded separators", () => {
  for (const value of [
    valid.replace("derickgomez-images.s3.us-east-1.amazonaws.com", "evil.invalid"),
    valid.replace("https://", "http://"),
    `${valid}?response-content-type=text/html`,
    `${valid.slice(0, valid.lastIndexOf("/"))}/../private.jpeg`,
    valid.replace("blog-images/", "blog-images/%2e%2e/"),
    valid.replace("blog-images/", "blog-images//"),
  ]) assert.equal(parseLegacyBlogImageReference(value), null, value);
});

test("local preview route is disabled in production and for malformed media identifiers", () => {
  assert.equal(localLegacyBlogImagePreviewUrl("legacy-post-media-28", valid, { NODE_ENV: "production", LOCAL_PG_INTEGRATION: "1" }), null);
  assert.equal(localLegacyBlogImagePreviewUrl("legacy-post-media-28", valid, { NODE_ENV: "development", LOCAL_PG_INTEGRATION: "" }), null);
  assert.equal(localLegacyBlogImagePreviewUrl("../other", valid, { NODE_ENV: "development", LOCAL_PG_INTEGRATION: "1" }), null);
  assert.equal(legacyBlogImageMediaId("legacy-post-media-28"), "legacy-post-media-28");
  assert.equal(legacyBlogImageMediaId("%2fsecret"), null);
});
