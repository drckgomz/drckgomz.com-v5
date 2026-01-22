// src/lib/admin/types.ts
export type PostStatus = "draft" | "private" | "public" | "archived";

export type AdminPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;

  // allow null from DB, but we’ll normalize before UI use
  status: PostStatus | string | null;

  date: string | null;
  thumbnail_url: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export function normalizeAdminPost(p: AdminPost): AdminPost {
  return {
    ...p,
    status: p.status ?? "draft",
  };
}
