// frontend/src/features/projects/lib/types.ts
export type ProjectMedia = {
  id?: string;
  project_id?: string;
  type: "image" | "youtube" | "instagram";
  url: string;
  caption?: string | null;
  idx?: number | null;
  meta?: Record<string, any>;
};

export type Project = {
  id: string;
  idx: number;
  title: string;
  slug: string | null;
  excerpt: string | null;
  href: string | null;
  color: string | null;
  image_url: string | null;
  content: string | null;
  status: "public" | "private" | "draft";
  created_at?: string;
  updated_at?: string;
  media?: ProjectMedia[];
};

export const TABS = ["all", "public", "private", "draft"] as const;
export type Tab = (typeof TABS)[number];

export type MediaItem = ProjectMedia;