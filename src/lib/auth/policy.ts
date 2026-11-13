/** Shared server authorization decisions. Client-side flags are never authority. */
export type AccessProfile = {
  id: string;
  enabled?: boolean;
  is_banned?: boolean;
  role?: string | null;
  is_owner?: boolean;
  is_whitelist_admin?: boolean;
  can_view_private?: boolean;
};

export function isActive(profile: AccessProfile | null): profile is AccessProfile {
  return profile?.enabled === true && profile.is_banned === false;
}

export function isAdmin(profile: AccessProfile | null): boolean {
  return isActive(profile) &&
    (profile.is_owner === true || ["admin", "content_admin", "owner"].includes(profile.role?.toLowerCase() ?? ""));
}

export function canViewPrivate(profile: AccessProfile | null): boolean {
  return isActive(profile) && (isAdmin(profile) || profile.can_view_private === true);
}

export type ContentAccess = {
  status?: string | null;
  deleted_at?: unknown;
  deletion_date?: unknown;
  is_deleted?: unknown;
};

export function isDeleted(content: ContentAccess): boolean {
  return content.deleted_at != null || content.deletion_date != null ||
    (content.is_deleted != null && content.is_deleted !== false);
}

export function readablePostStatuses(profile: AccessProfile | null): string[] {
  if (profile && !isActive(profile)) return [];
  if (isAdmin(profile)) return ["public", "private", "draft", "archived"];
  return canViewPrivate(profile) ? ["public", "private"] : ["public"];
}

/** Statuses available through normal blog reader endpoints, never CMS preview. */
export function publicBlogReadableStatuses(profile: AccessProfile | null): string[] {
  return readablePostStatuses(profile).filter((status) => status === "public" || status === "private");
}

export function canReadPost(content: ContentAccess, profile: AccessProfile | null): boolean {
  return !isDeleted(content) && readablePostStatuses(profile).includes(content.status ?? "");
}

export function isPublicProject(content: ContentAccess | null): boolean {
  return content !== null && content.status === "public" && !isDeleted(content);
}
