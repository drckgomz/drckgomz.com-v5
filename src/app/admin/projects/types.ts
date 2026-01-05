// src/app/admin/projects/types.ts
export type ProjectStatus = "public" | "draft";
export type Tab = "all" | ProjectStatus;

export type Project = {
  id: string;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  status: ProjectStatus;
  updated_at?: string | null;

  // cover image (chosen from home_project_media via admin media library)
  image_url?: string | null;

  href?: string | null;
};

export const TABS: Tab[] = ["all", "public", "draft"];
