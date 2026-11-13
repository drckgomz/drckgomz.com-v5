import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const authSchema = pgSchema("auth");
export const appSchema = pgSchema("app");
export const legacySchema = pgSchema("legacy");
export const opsSchema = pgSchema("ops");

// Better Auth's core schema. Social registration creates identities; app privileges live separately.
export const authUsers = authSchema.table("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("auth_user_email_uq").on(sql`lower(${table.email})`)]);

export const authSessions = authSchema.table("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  token: text("token").notNull(),
  // Maintained by the auth.session BEFORE INSERT/UPDATE trigger in migration
  // 0003. PostgreSQL marks convert_to(text, name) STABLE, so this cannot be a
  // generated column even though sha256 and encode themselves are immutable.
  // Better Auth does not know about this derived column. The DB default lets
  // its Drizzle adapter omit it; migration 0003's BEFORE trigger replaces the
  // empty sentinel with the digest before the NOT NULL constraint is checked.
  tokenSha256: text("token_sha256").notNull().default(""),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("auth_session_token_uq").on(table.token),
  uniqueIndex("auth_session_token_sha256_uq").on(table.tokenSha256),
  index("auth_session_user_idx").on(table.userId),
]);

export const authAccounts = authSchema.table("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true, mode: "date" }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true, mode: "date" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  index("auth_account_user_idx").on(table.userId),
  uniqueIndex("auth_account_provider_account_uq").on(table.providerId, table.accountId),
]);

export const authVerifications = authSchema.table("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow(),
}, (table) => [index("auth_verification_identifier_idx").on(table.identifier)]);

export const publicationState = pgEnum("publication_state", ["draft", "published", "archived"]);
export const contentVisibility = pgEnum("content_visibility", ["public", "members", "close_friends", "selected_people", "private"]);
export const appearancePublication = pgEnum("appearance_publication", ["draft", "published"]);

export const userProfiles = appSchema.table("user_profiles", {
  id: text("id").primaryKey().references(() => authUsers.id, { onDelete: "restrict" }),
  username: text("username").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  avatarColor: text("avatar_color"),
  enabled: boolean("enabled").notNull().default(false),
  bannedAt: timestamp("banned_at", { withTimezone: true, mode: "date" }),
  bannedReason: text("banned_reason"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
}, (table) => [uniqueIndex("app_user_profiles_username_uq").on(sql`lower(${table.username})`), check("app_user_profiles_version_ck", sql`${table.version} > 0`)]);

export const userRoles = appSchema.table("user_roles", {
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "restrict" }),
  role: text("role").notNull(),
  grantedBy: text("granted_by").references(() => userProfiles.id, { onDelete: "restrict" }),
  grantedAt: timestamp("granted_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("app_user_roles_user_role_uq").on(table.userId, table.role),
  index("app_user_roles_role_idx").on(table.role, table.userId),
  uniqueIndex("app_user_roles_single_owner_uq").on(table.role).where(sql`${table.role} = 'owner'`),
  check("app_user_roles_role_ck", sql`${table.role} in ('owner', 'content_admin', 'whitelist_manager')`),
]);

export const userCapabilities = appSchema.table("user_capabilities", {
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "restrict" }),
  capability: text("capability").notNull(),
  grantedBy: text("granted_by").references(() => userProfiles.id, { onDelete: "restrict" }),
  grantedAt: timestamp("granted_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("app_user_capabilities_user_capability_uq").on(table.userId, table.capability),
  index("app_user_capabilities_capability_idx").on(table.capability, table.userId),
  check("app_user_capabilities_capability_ck", sql`${table.capability} in ('private_blog.read')`),
]);

export const securityAuditEvents = appSchema.table("security_audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: text("actor_user_id").references(() => userProfiles.id, { onDelete: "restrict" }),
  subjectUserId: text("subject_user_id").references(() => userProfiles.id, { onDelete: "restrict" }),
  action: text("action").notNull(),
  evidenceRef: text("evidence_ref"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [index("app_security_audit_subject_idx").on(table.subjectUserId, table.createdAt)]);

export const posts = appSchema.table("posts", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  excerpt: text("excerpt"),
  content: text("content").notNull().default(""),
  publicationState: publicationState("publication_state").notNull().default("draft"),
  visibility: contentVisibility("visibility").notNull().default("private"),
  publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
  date: date("date", { mode: "string" }),
  thumbnailUrl: text("thumbnail_url"),
  legacyViews: integer("legacy_views"),
  legacyStatus: text("legacy_status"),
  deletedAt: timestamp("deleted_at", { withTimezone: false, mode: "string" }),
  deletionDate: timestamp("deletion_date", { withTimezone: false, mode: "string" }),
  authorUserId: text("author_user_id").references(() => userProfiles.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  revision: integer("revision").notNull().default(1),
}, (table) => [
  uniqueIndex("app_posts_slug_ci_uq").on(sql`lower(${table.slug})`),
  index("app_posts_public_idx").on(table.publicationState, table.visibility, table.publishedAt),
  index("app_posts_created_idx").on(table.createdAt),
  check("app_posts_title_ck", sql`length(trim(${table.title})) > 0`),
  check("app_posts_slug_ck", sql`length(trim(${table.slug})) > 0`),
  check("app_posts_revision_ck", sql`${table.revision} > 0`),
]);

export const media = appSchema.table("media", {
  id: text("id").primaryKey(),
  postId: text("post_id").notNull().references(() => posts.id, { onDelete: "restrict" }),
  type: text("type").notNull(),
  url: text("url"),
  caption: text("caption"),
  idx: integer("idx").notNull().default(0),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  sourceMediaId: text("source_media_id"),
}, (table) => [
  index("app_media_post_idx").on(table.postId, table.idx),
  check("app_media_idx_ck", sql`${table.idx} >= 0`),
  check("app_media_type_ck", sql`${table.type} in ('image', 'youtube', 'instagram', 'video', 'file')`),
]);

export const homeSections = appSchema.table("home_sections", {
  key: text("key").primaryKey(),
  title: text("title"),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),
  body: jsonb("body"),
  sortOrder: integer("sort_order").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
}, (table) => [check("app_home_sections_version_ck", sql`${table.version} > 0`)]);

export const homeMedia = appSchema.table("home_media", {
  id: text("id").primaryKey(),
  sectionKey: text("section_key").notNull().references(() => homeSections.key, { onDelete: "restrict" }),
  type: text("type").notNull(),
  url: text("url").notNull(),
  caption: text("caption"),
  idx: integer("idx").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [index("app_home_media_section_idx").on(table.sectionKey, table.idx)]);

export const homeProjects = appSchema.table("home_projects", {
  id: text("id").primaryKey(),
  idx: integer("idx").notNull().default(0),
  title: text("title").notNull(),
  slug: text("slug"),
  excerpt: text("excerpt"),
  href: text("href"),
  color: text("color"),
  imageUrl: text("image_url"),
  content: text("content"),
  deletedAt: timestamp("deleted_at", { withTimezone: false, mode: "string" }),
  deletionDate: timestamp("deletion_date", { withTimezone: false, mode: "string" }),
  publicationState: publicationState("publication_state").notNull().default("draft"),
  visibility: contentVisibility("visibility").notNull().default("private"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  revision: integer("revision").notNull().default(1),
}, (table) => [
  uniqueIndex("app_home_projects_slug_ci_uq").on(sql`lower(${table.slug})`).where(sql`${table.slug} is not null`),
  index("app_home_projects_public_order_idx").on(table.publicationState, table.visibility, table.idx),
  check("app_home_projects_revision_ck", sql`${table.revision} > 0`),
]);

export const homeProjectMedia = appSchema.table("home_project_media", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => homeProjects.id, { onDelete: "restrict" }),
  type: text("type").notNull(),
  url: text("url").notNull(),
  caption: text("caption"),
  idx: integer("idx").notNull().default(0),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [index("app_home_project_media_project_idx").on(table.projectId, table.idx)]);

export const categories = appSchema.table("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("app_categories_slug_ci_uq").on(sql`lower(${table.slug})`)]);

export const postCategories = appSchema.table("post_categories", {
  postId: text("post_id").notNull().references(() => posts.id, { onDelete: "restrict" }),
  categoryId: text("category_id").notNull().references(() => categories.id, { onDelete: "restrict" }),
}, (table) => [uniqueIndex("app_post_categories_uq").on(table.postId, table.categoryId)]);

export const tags = appSchema.table("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
}, (table) => [uniqueIndex("app_tags_slug_ci_uq").on(sql`lower(${table.slug})`)]);

export const postTags = appSchema.table("post_tags", {
  postId: text("post_id").notNull().references(() => posts.id, { onDelete: "restrict" }),
  tagId: text("tag_id").notNull().references(() => tags.id, { onDelete: "restrict" }),
}, (table) => [uniqueIndex("app_post_tags_uq").on(table.postId, table.tagId)]);

export const audienceGroups = appSchema.table("audience_groups", {
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [check("app_audience_groups_key_ck", sql`${table.key} in ('members', 'close_friends')`)]);

export const audienceMemberships = appSchema.table("audience_memberships", {
  groupKey: text("group_key").notNull().references(() => audienceGroups.key, { onDelete: "restrict" }),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "restrict" }),
  grantedBy: text("granted_by").notNull().references(() => userProfiles.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("app_audience_memberships_user_group_uq").on(table.userId, table.groupKey),
  index("app_audience_memberships_group_user_idx").on(table.groupKey, table.userId),
]);

export const postAccessGrants = appSchema.table("post_access_grants", {
  postId: text("post_id").notNull().references(() => posts.id, { onDelete: "restrict" }),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "restrict" }),
  grantedBy: text("granted_by").notNull().references(() => userProfiles.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
}, (table) => [
  uniqueIndex("app_post_access_grants_post_user_uq").on(table.postId, table.userId),
  index("app_post_access_grants_user_post_active_idx").on(table.userId, table.postId).where(sql`${table.revokedAt} is null`),
]);

export const postAccessRequests = appSchema.table("post_access_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: text("post_id").notNull().references(() => posts.id, { onDelete: "restrict" }),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "restrict" }),
  status: text("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
  reviewedBy: text("reviewed_by").references(() => userProfiles.id, { onDelete: "restrict" }),
}, (table) => [
  index("app_post_access_requests_status_date_idx").on(table.status, table.requestedAt),
  uniqueIndex("app_post_access_requests_pending_uq").on(table.postId, table.userId).where(sql`${table.status} = 'pending'`),
  check("app_post_access_requests_status_ck", sql`${table.status} in ('pending', 'approved', 'denied', 'cancelled')`),
]);

/** Appearance references opaque media IDs; object keys never enter public DTOs. */
export const siteMedia = appSchema.table("site_media", {
  id: text("id").primaryKey(),
  storageKey: text("storage_key").notNull(),
  kind: text("kind").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  altText: text("alt_text").notNull().default(""),
  createdBy: text("created_by").notNull().references(() => userProfiles.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("app_site_media_storage_key_uq").on(table.storageKey),
  index("app_site_media_created_idx").on(table.createdAt),
  check("app_site_media_kind_ck", sql`${table.kind} in ('image', 'video', 'poster')`),
  check("app_site_media_size_ck", sql`${table.sizeBytes} > 0`),
]);

export const appearanceSettings = appSchema.table("appearance_settings", {
  key: text("key").primaryKey(),
  draft: jsonb("draft").notNull().default({}),
  published: jsonb("published").notNull().default({}),
  publication: appearancePublication("publication").notNull().default("draft"),
  version: integer("version").notNull().default(1),
  updatedBy: text("updated_by").references(() => userProfiles.id, { onDelete: "restrict" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [
  check("app_appearance_settings_key_ck", sql`${table.key} in ('homepage', 'blog', 'terminal')`),
  check("app_appearance_settings_version_ck", sql`${table.version} > 0`),
]);

export const terminalCommands = appSchema.table("terminal_commands", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  aliases: jsonb("aliases").notNull().default([]),
  description: text("description").notNull().default(""),
  actions: jsonb("actions").notNull().default([]),
  requiresAuth: boolean("requires_auth").notNull().default(true),
  requiredRole: text("role"),
  showInHelp: boolean("show_in_help").notNull().default(false),
  enabled: boolean("enabled").notNull().default(false),
  rateLimitPerMin: integer("rate_limit_per_min").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
}, (table) => [check("app_terminal_rate_ck", sql`${table.rateLimitPerMin} >= 0`)]);

// Exact legacy model archive (credentials/reset secrets intentionally omitted).
const legacyTimestamp = (name: string) => timestamp(name, { withTimezone: false, mode: "string" });
export const legacyPosts = legacySchema.table("posts", {
  id: uuid("id").primaryKey(), title: text("title").notNull(), content: text("content").notNull(),
  views: integer("views"), createdAt: legacyTimestamp("created_at"), updatedAt: legacyTimestamp("updated_at"),
  deletedAt: legacyTimestamp("deleted_at"), status: text("status"), deletionDate: legacyTimestamp("deletion_date"),
});
export const legacyMedia = legacySchema.table("media", {
  id: uuid("id").primaryKey(), url: text("url").notNull(), key: text("key"), caption: text("caption"),
  type: text("type"), uploadedAt: legacyTimestamp("uploaded_at"), context: text("context"), title: text("title"), orderIndex: integer("order_index"),
});
export const legacyContent = legacySchema.table("content", {
  id: integer("id").primaryKey(), type: text("type").notNull(), title: text("title"), url: text("url"),
  description: text("description"), orderIndex: integer("order_index"), createdAt: legacyTimestamp("created_at"),
  thumbnailUrl: text("thumbnail_url"), mediaId: uuid("media_id").references(() => legacyMedia.id, { onDelete: "restrict" }),
});
export const legacyContentMedia = legacySchema.table("content_media", {
  id: uuid("id").primaryKey(), contentId: integer("content_id").notNull().references(() => legacyContent.id, { onDelete: "restrict" }),
  mediaId: uuid("media_id").notNull().references(() => legacyMedia.id, { onDelete: "restrict" }),
  position: integer("position"), contextLabel: text("context_label"), createdAt: legacyTimestamp("created_at"),
});
export const legacyPostMedia = legacySchema.table("post_media", {
  id: integer("id").primaryKey(), postId: uuid("post_id").references(() => legacyPosts.id, { onDelete: "restrict" }),
  mediaId: uuid("media_id").references(() => legacyMedia.id, { onDelete: "restrict" }), mediaOrder: integer("media_order"),
});
export const legacyUsers = legacySchema.table("users", {
  id: integer("id").primaryKey(), username: text("username").notNull(), isAdmin: boolean("is_admin"),
  createdAt: legacyTimestamp("created_at"), email: text("email").notNull(), userId: uuid("user_id"),
  needsSetup: boolean("needs_setup"), profileColor: text("profile_color"),
});
export const legacyBugReports = legacySchema.table("bug_reports", {
  id: integer("id").primaryKey(), description: text("description").notNull(), reportedAt: legacyTimestamp("reported_at"),
});

export const legacyImportRuns = opsSchema.table("legacy_import_runs", {
  id: uuid("id").primaryKey(), sourceFingerprint: text("source_fingerprint").notNull(),
  mappingVersion: text("mapping_version").notNull(), status: text("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }), report: jsonb("report").notNull().default({}),
}, (table) => [check("ops_legacy_import_status_ck", sql`${table.status} in ('planned', 'validating', 'imported', 'failed', 'rolled_back')`)]);

export const legacyEntityMap = opsSchema.table("legacy_entity_map", {
  runId: uuid("run_id").notNull().references(() => legacyImportRuns.id, { onDelete: "restrict" }),
  sourceNamespace: text("source_namespace").notNull(), sourceTable: text("source_table").notNull(),
  sourceId: text("source_id").notNull(), targetSchema: text("target_schema").notNull(),
  targetTable: text("target_table").notNull(), targetId: text("target_id").notNull(),
  sourceFingerprint: text("source_fingerprint").notNull(), mappingVersion: text("mapping_version").notNull(),
  reviewState: text("review_state").notNull().default("pending"),
}, (table) => [
  uniqueIndex("ops_legacy_entity_map_source_uq").on(table.runId, table.sourceNamespace, table.sourceTable, table.sourceId),
  index("ops_legacy_entity_map_target_idx").on(table.targetSchema, table.targetTable, table.targetId),
  check("ops_legacy_entity_map_review_ck", sql`${table.reviewState} in ('pending', 'mapped', 'quarantined', 'conflict')`),
]);
