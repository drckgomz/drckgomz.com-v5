// src/components/blog/admin/posts/types.ts
export type MediaItem = {
  type: "image" | "youtube" | "instagram";
  url: string;
  idx?: number | null;
};

export type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  status: "public" | "private" | "draft" | "archived";
  date?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  revision?: number;
  thumbnail_url?: string | null;
  media?: MediaItem[] | null;
};

export const TABS = ["all", "public", "private", "draft", "archived"] as const;
export type Tab = (typeof TABS)[number];
