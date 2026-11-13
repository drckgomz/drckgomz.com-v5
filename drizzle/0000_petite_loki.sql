CREATE SCHEMA "app";
--> statement-breakpoint
CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE SCHEMA "legacy";
--> statement-breakpoint
CREATE SCHEMA "ops";
--> statement-breakpoint
CREATE TYPE "public"."content_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."publication_state" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "auth"."account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."home_media" (
	"id" text PRIMARY KEY NOT NULL,
	"section_key" text NOT NULL,
	"type" text NOT NULL,
	"url" text NOT NULL,
	"caption" text,
	"idx" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."home_project_media" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"type" text NOT NULL,
	"url" text NOT NULL,
	"caption" text,
	"idx" integer DEFAULT 0 NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."home_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"idx" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"slug" text,
	"excerpt" text,
	"href" text,
	"color" text,
	"image_url" text,
	"content" text,
	"publication_state" "publication_state" DEFAULT 'draft' NOT NULL,
	"visibility" "content_visibility" DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."home_sections" (
	"key" text PRIMARY KEY NOT NULL,
	"title" text,
	"description" text,
	"thumbnail_url" text,
	"body" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legacy"."bug_reports" (
	"id" integer PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"reported_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "legacy"."content" (
	"id" integer PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"title" text,
	"url" text,
	"description" text,
	"order_index" integer,
	"created_at" timestamp,
	"thumbnail_url" text,
	"media_id" uuid
);
--> statement-breakpoint
CREATE TABLE "legacy"."content_media" (
	"id" uuid PRIMARY KEY NOT NULL,
	"content_id" integer NOT NULL,
	"media_id" uuid NOT NULL,
	"position" integer,
	"context_label" text,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ops"."legacy_entity_map" (
	"run_id" uuid NOT NULL,
	"source_namespace" text NOT NULL,
	"source_table" text NOT NULL,
	"source_id" text NOT NULL,
	"target_schema" text NOT NULL,
	"target_table" text NOT NULL,
	"target_id" text NOT NULL,
	"source_fingerprint" text NOT NULL,
	"mapping_version" text NOT NULL,
	"review_state" text DEFAULT 'pending' NOT NULL,
	CONSTRAINT "ops_legacy_entity_map_review_ck" CHECK ("ops"."legacy_entity_map"."review_state" in ('pending', 'mapped', 'quarantined', 'conflict'))
);
--> statement-breakpoint
CREATE TABLE "ops"."legacy_import_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_fingerprint" text NOT NULL,
	"mapping_version" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"report" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "ops_legacy_import_status_ck" CHECK ("ops"."legacy_import_runs"."status" in ('planned', 'validating', 'imported', 'failed', 'rolled_back'))
);
--> statement-breakpoint
CREATE TABLE "legacy"."media" (
	"id" uuid PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"key" text,
	"caption" text,
	"type" text,
	"uploaded_at" timestamp,
	"context" text,
	"title" text,
	"order_index" integer
);
--> statement-breakpoint
CREATE TABLE "legacy"."post_media" (
	"id" integer PRIMARY KEY NOT NULL,
	"post_id" uuid,
	"media_id" uuid,
	"media_order" integer
);
--> statement-breakpoint
CREATE TABLE "legacy"."posts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"views" integer,
	"created_at" timestamp,
	"updated_at" timestamp,
	"deleted_at" timestamp,
	"status" text,
	"deletion_date" timestamp
);
--> statement-breakpoint
CREATE TABLE "legacy"."users" (
	"id" integer PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"is_admin" boolean,
	"created_at" timestamp,
	"email" text NOT NULL,
	"user_id" uuid,
	"needs_setup" boolean,
	"profile_color" text
);
--> statement-breakpoint
CREATE TABLE "app"."media" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"type" text NOT NULL,
	"url" text,
	"caption" text,
	"idx" integer DEFAULT 0 NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_media_id" text,
	CONSTRAINT "app_media_idx_ck" CHECK ("app"."media"."idx" >= 0),
	CONSTRAINT "app_media_type_ck" CHECK ("app"."media"."type" in ('image', 'youtube', 'instagram', 'video', 'file'))
);
--> statement-breakpoint
CREATE TABLE "app"."post_categories" (
	"post_id" text NOT NULL,
	"category_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."post_tags" (
	"post_id" text NOT NULL,
	"tag_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."posts" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"content" text DEFAULT '' NOT NULL,
	"publication_state" "publication_state" DEFAULT 'draft' NOT NULL,
	"visibility" "content_visibility" DEFAULT 'private' NOT NULL,
	"published_at" timestamp with time zone,
	"date" date,
	"thumbnail_url" text,
	"legacy_views" integer,
	"legacy_status" text,
	"deleted_at" timestamp,
	"deletion_date" timestamp,
	"author_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "app_posts_title_ck" CHECK (length(trim("app"."posts"."title")) > 0),
	CONSTRAINT "app_posts_slug_ck" CHECK (length(trim("app"."posts"."slug")) > 0),
	CONSTRAINT "app_posts_revision_ck" CHECK ("app"."posts"."revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."security_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text,
	"subject_user_id" text,
	"action" text NOT NULL,
	"evidence_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."tags" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."terminal_commands" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"requires_auth" boolean DEFAULT true NOT NULL,
	"role" text,
	"show_in_help" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"rate_limit_per_min" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "app_terminal_rate_ck" CHECK ("app"."terminal_commands"."rate_limit_per_min" >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."user_capabilities" (
	"user_id" text NOT NULL,
	"capability" text NOT NULL,
	"granted_by" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_user_capabilities_capability_ck" CHECK ("app"."user_capabilities"."capability" in ('private_blog.read'))
);
--> statement-breakpoint
CREATE TABLE "app"."user_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"avatar_color" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"banned_at" timestamp with time zone,
	"banned_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "app_user_profiles_version_ck" CHECK ("app"."user_profiles"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."user_roles" (
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"granted_by" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_user_roles_role_ck" CHECK ("app"."user_roles"."role" in ('owner', 'content_admin', 'whitelist_manager'))
);
--> statement-breakpoint
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."home_media" ADD CONSTRAINT "home_media_section_key_home_sections_key_fk" FOREIGN KEY ("section_key") REFERENCES "app"."home_sections"("key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."home_project_media" ADD CONSTRAINT "home_project_media_project_id_home_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "app"."home_projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy"."content" ADD CONSTRAINT "content_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "legacy"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy"."content_media" ADD CONSTRAINT "content_media_content_id_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "legacy"."content"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy"."content_media" ADD CONSTRAINT "content_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "legacy"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ops"."legacy_entity_map" ADD CONSTRAINT "legacy_entity_map_run_id_legacy_import_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "ops"."legacy_import_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy"."post_media" ADD CONSTRAINT "post_media_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "legacy"."posts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy"."post_media" ADD CONSTRAINT "post_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "legacy"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."media" ADD CONSTRAINT "media_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "app"."posts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."post_categories" ADD CONSTRAINT "post_categories_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "app"."posts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."post_categories" ADD CONSTRAINT "post_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "app"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."post_tags" ADD CONSTRAINT "post_tags_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "app"."posts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."post_tags" ADD CONSTRAINT "post_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "app"."tags"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."posts" ADD CONSTRAINT "posts_author_user_id_user_profiles_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "app"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."security_audit_events" ADD CONSTRAINT "security_audit_events_actor_user_id_user_profiles_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "app"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."security_audit_events" ADD CONSTRAINT "security_audit_events_subject_user_id_user_profiles_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "app"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_capabilities" ADD CONSTRAINT "user_capabilities_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_capabilities" ADD CONSTRAINT "user_capabilities_granted_by_user_profiles_id_fk" FOREIGN KEY ("granted_by") REFERENCES "app"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_profiles" ADD CONSTRAINT "user_profiles_id_user_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_roles" ADD CONSTRAINT "user_roles_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_roles" ADD CONSTRAINT "user_roles_granted_by_user_profiles_id_fk" FOREIGN KEY ("granted_by") REFERENCES "app"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_account_user_idx" ON "auth"."account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_account_provider_account_uq" ON "auth"."account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_session_token_uq" ON "auth"."session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "auth_session_user_idx" ON "auth"."session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_user_email_uq" ON "auth"."user" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "auth_verification_identifier_idx" ON "auth"."verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "app_categories_slug_ci_uq" ON "app"."categories" USING btree (lower("slug"));--> statement-breakpoint
CREATE INDEX "app_home_media_section_idx" ON "app"."home_media" USING btree ("section_key","idx");--> statement-breakpoint
CREATE INDEX "app_home_project_media_project_idx" ON "app"."home_project_media" USING btree ("project_id","idx");--> statement-breakpoint
CREATE UNIQUE INDEX "app_home_projects_slug_ci_uq" ON "app"."home_projects" USING btree (lower("slug")) WHERE "app"."home_projects"."slug" is not null;--> statement-breakpoint
CREATE INDEX "app_home_projects_public_order_idx" ON "app"."home_projects" USING btree ("publication_state","visibility","idx");--> statement-breakpoint
CREATE UNIQUE INDEX "ops_legacy_entity_map_source_uq" ON "ops"."legacy_entity_map" USING btree ("run_id","source_namespace","source_table","source_id");--> statement-breakpoint
CREATE INDEX "ops_legacy_entity_map_target_idx" ON "ops"."legacy_entity_map" USING btree ("target_schema","target_table","target_id");--> statement-breakpoint
CREATE INDEX "app_media_post_idx" ON "app"."media" USING btree ("post_id","idx");--> statement-breakpoint
CREATE UNIQUE INDEX "app_post_categories_uq" ON "app"."post_categories" USING btree ("post_id","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "app_post_tags_uq" ON "app"."post_tags" USING btree ("post_id","tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "app_posts_slug_ci_uq" ON "app"."posts" USING btree (lower("slug"));--> statement-breakpoint
CREATE INDEX "app_posts_public_idx" ON "app"."posts" USING btree ("publication_state","visibility","published_at");--> statement-breakpoint
CREATE INDEX "app_posts_created_idx" ON "app"."posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "app_security_audit_subject_idx" ON "app"."security_audit_events" USING btree ("subject_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "app_tags_slug_ci_uq" ON "app"."tags" USING btree (lower("slug"));--> statement-breakpoint
CREATE UNIQUE INDEX "app_user_capabilities_user_capability_uq" ON "app"."user_capabilities" USING btree ("user_id","capability");--> statement-breakpoint
CREATE INDEX "app_user_capabilities_capability_idx" ON "app"."user_capabilities" USING btree ("capability","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "app_user_profiles_username_uq" ON "app"."user_profiles" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "app_user_roles_user_role_uq" ON "app"."user_roles" USING btree ("user_id","role");--> statement-breakpoint
CREATE INDEX "app_user_roles_role_idx" ON "app"."user_roles" USING btree ("role","user_id");