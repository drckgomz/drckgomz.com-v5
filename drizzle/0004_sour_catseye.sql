CREATE TYPE "public"."appearance_publication" AS ENUM('draft', 'published');--> statement-breakpoint
ALTER TYPE "public"."content_visibility" ADD VALUE 'members' BEFORE 'private';--> statement-breakpoint
ALTER TYPE "public"."content_visibility" ADD VALUE 'close_friends' BEFORE 'private';--> statement-breakpoint
ALTER TYPE "public"."content_visibility" ADD VALUE 'selected_people' BEFORE 'private';--> statement-breakpoint
CREATE TABLE "app"."appearance_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"draft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"publication" "appearance_publication" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_appearance_settings_key_ck" CHECK ("app"."appearance_settings"."key" in ('homepage', 'blog', 'terminal')),
	CONSTRAINT "app_appearance_settings_version_ck" CHECK ("app"."appearance_settings"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "app"."audience_groups" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_audience_groups_key_ck" CHECK ("app"."audience_groups"."key" in ('members', 'close_friends'))
);
--> statement-breakpoint
CREATE TABLE "app"."audience_memberships" (
	"group_key" text NOT NULL,
	"user_id" text NOT NULL,
	"granted_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."post_access_grants" (
	"post_id" text NOT NULL,
	"user_id" text NOT NULL,
	"granted_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."post_access_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" text,
	CONSTRAINT "app_post_access_requests_status_ck" CHECK ("app"."post_access_requests"."status" in ('pending', 'approved', 'denied', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "app"."site_media" (
	"id" text PRIMARY KEY NOT NULL,
	"storage_key" text NOT NULL,
	"kind" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"alt_text" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_site_media_kind_ck" CHECK ("app"."site_media"."kind" in ('image', 'video', 'poster')),
	CONSTRAINT "app_site_media_size_ck" CHECK ("app"."site_media"."size_bytes" > 0)
);
--> statement-breakpoint
ALTER TABLE "app"."appearance_settings" ADD CONSTRAINT "appearance_settings_updated_by_user_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "app"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."audience_memberships" ADD CONSTRAINT "audience_memberships_group_key_audience_groups_key_fk" FOREIGN KEY ("group_key") REFERENCES "app"."audience_groups"("key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."audience_memberships" ADD CONSTRAINT "audience_memberships_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."audience_memberships" ADD CONSTRAINT "audience_memberships_granted_by_user_profiles_id_fk" FOREIGN KEY ("granted_by") REFERENCES "app"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."post_access_grants" ADD CONSTRAINT "post_access_grants_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "app"."posts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."post_access_grants" ADD CONSTRAINT "post_access_grants_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."post_access_grants" ADD CONSTRAINT "post_access_grants_granted_by_user_profiles_id_fk" FOREIGN KEY ("granted_by") REFERENCES "app"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."post_access_requests" ADD CONSTRAINT "post_access_requests_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "app"."posts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."post_access_requests" ADD CONSTRAINT "post_access_requests_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."post_access_requests" ADD CONSTRAINT "post_access_requests_reviewed_by_user_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "app"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."site_media" ADD CONSTRAINT "site_media_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "app"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "app_audience_memberships_user_group_uq" ON "app"."audience_memberships" USING btree ("user_id","group_key");--> statement-breakpoint
CREATE INDEX "app_audience_memberships_group_user_idx" ON "app"."audience_memberships" USING btree ("group_key","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "app_post_access_grants_post_user_uq" ON "app"."post_access_grants" USING btree ("post_id","user_id");--> statement-breakpoint
CREATE INDEX "app_post_access_grants_user_post_active_idx" ON "app"."post_access_grants" USING btree ("user_id","post_id") WHERE "app"."post_access_grants"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "app_post_access_requests_status_date_idx" ON "app"."post_access_requests" USING btree ("status","requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "app_post_access_requests_pending_uq" ON "app"."post_access_requests" USING btree ("post_id","user_id") WHERE "app"."post_access_requests"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "app_site_media_storage_key_uq" ON "app"."site_media" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "app_site_media_created_idx" ON "app"."site_media" USING btree ("created_at");
--> statement-breakpoint
-- New audience and appearance data is deny-by-default until the separately
-- reviewed SECURITY DEFINER policies/functions are installed and verified.
REVOKE ALL ON TABLE "app"."audience_groups", "app"."audience_memberships",
  "app"."post_access_grants", "app"."post_access_requests",
  "app"."site_media", "app"."appearance_settings" FROM PUBLIC;
--> statement-breakpoint
ALTER TABLE "app"."audience_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app"."audience_groups" FORCE ROW LEVEL SECURITY;
ALTER TABLE "app"."audience_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app"."audience_memberships" FORCE ROW LEVEL SECURITY;
ALTER TABLE "app"."post_access_grants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app"."post_access_grants" FORCE ROW LEVEL SECURITY;
ALTER TABLE "app"."post_access_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app"."post_access_requests" FORCE ROW LEVEL SECURITY;
ALTER TABLE "app"."site_media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app"."site_media" FORCE ROW LEVEL SECURITY;
ALTER TABLE "app"."appearance_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app"."appearance_settings" FORCE ROW LEVEL SECURITY;
