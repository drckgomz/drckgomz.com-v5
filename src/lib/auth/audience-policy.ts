export type PostPublication = "draft" | "published" | "archived";
export type PostAudience = "public" | "members" | "close_friends" | "selected_people" | "private";

export type PostAudienceRecord = {
  publicationState: string;
  visibility: string;
  deleted?: boolean;
};

export type AudienceViewer = {
  authenticated: boolean;
  active: boolean;
  owner: boolean;
  member: boolean;
  closeFriend: boolean;
  selectedGrant: boolean;
};

/** Pure fail-closed policy mirror. Database RLS remains the enforcement boundary. */
export function canReadAudiencePost(post: PostAudienceRecord, viewer: AudienceViewer): boolean {
  if (post.deleted || post.publicationState === "archived") return false;
  if (post.publicationState === "draft") return viewer.authenticated && viewer.active && viewer.owner;
  if (post.publicationState !== "published") return false;
  if (post.visibility === "public") return true;
  if (!viewer.authenticated || !viewer.active) return false;
  switch (post.visibility) {
    case "members": return viewer.owner || viewer.member || viewer.selectedGrant;
    case "close_friends": return viewer.owner || viewer.closeFriend || viewer.selectedGrant;
    case "selected_people": return viewer.owner || viewer.selectedGrant;
    case "private": return viewer.owner;
    default: return false;
  }
}
