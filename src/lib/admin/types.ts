// src/lib/admin/types.ts
export type PostStatus = "draft" | "private" | "public" | "archived";

export type AdminPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  /** Unrendered source for nonlegacy edits; preview HTML must never be saved back. */
  editor_content?: string | null;
  legacy_content?: boolean;
  media?: unknown[] | null;

  // allow null from DB, but we’ll normalize before UI use
  status: PostStatus | string | null;

  date: string | null;
  published_at?: string | null;
  thumbnail_url: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  revision?: number;
  publication_state?: "draft" | "published" | "archived";
  visibility?: "public" | "members" | "close_friends" | "selected_people" | "private";
};

export function normalizeAdminPost(p: AdminPost): AdminPost {
  return {
    ...p,
    status: p.status ?? "draft",
  };
}
