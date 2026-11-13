import assert from "node:assert/strict";
import test from "node:test";
import { canReadAudiencePost, type AudienceViewer } from "../../src/lib/auth/audience-policy";

const anonymous: AudienceViewer = { authenticated: false, active: false, owner: false, member: false, closeFriend: false, selectedGrant: false };
const ordinary: AudienceViewer = { authenticated: true, active: true, owner: false, member: false, closeFriend: false, selectedGrant: false };

test("only published public posts are visible anonymously", () => {
  assert.equal(canReadAudiencePost({ publicationState: "published", visibility: "public" }, anonymous), true);
  for (const visibility of ["members", "close_friends", "selected_people", "private"]) {
    assert.equal(canReadAudiencePost({ publicationState: "published", visibility }, anonymous), false, visibility);
  }
});

test("membership, close-friend, selected-grant, private, and owner rules remain separate", () => {
  const member = { ...ordinary, member: true };
  const closeFriend = { ...ordinary, closeFriend: true };
  const selected = { ...ordinary, selectedGrant: true };
  const owner = { ...ordinary, owner: true };
  assert.equal(canReadAudiencePost({ publicationState: "published", visibility: "members" }, member), true);
  assert.equal(canReadAudiencePost({ publicationState: "published", visibility: "close_friends" }, member), false);
  assert.equal(canReadAudiencePost({ publicationState: "published", visibility: "close_friends" }, closeFriend), true);
  assert.equal(canReadAudiencePost({ publicationState: "published", visibility: "selected_people" }, selected), true);
  assert.equal(canReadAudiencePost({ publicationState: "published", visibility: "private" }, selected), false);
  assert.equal(canReadAudiencePost({ publicationState: "draft", visibility: "public" }, owner), true);
  assert.equal(canReadAudiencePost({ publicationState: "draft", visibility: "public" }, ordinary), false);
});

test("blocked accounts, deleted records, archived records, and unknown values deny access", () => {
  const blocked = { ...ordinary, active: false };
  assert.equal(canReadAudiencePost({ publicationState: "published", visibility: "members" }, blocked), false);
  assert.equal(canReadAudiencePost({ publicationState: "published", visibility: "public", deleted: true }, ordinary), false);
  assert.equal(canReadAudiencePost({ publicationState: "archived", visibility: "public" }, ordinary), false);
  assert.equal(canReadAudiencePost({ publicationState: "published", visibility: "future-audience" }, { ...ordinary, owner: true }), false);
  assert.equal(canReadAudiencePost({ publicationState: "scheduled", visibility: "public" }, ordinary), false);
});
