// frontend/src/features/home/components/project/useProjectDetail.ts
"use client";
import * as React from "react";

export type Project = {
  id: string;
  idx?: number | null;
  title: string;
  slug?: string | null;
  excerpt?: string | null;
  href?: string | null;
  color?: string | null;
  image_url?: string | null;
  content?: string | null;
};

export type ProjectMedia = {
  id: string;
  type: "image" | "youtube" | "instagram" | string;
  url: string;
  caption?: string | null;
  idx?: number | null;
  meta?: any;
  created_at?: string;
};

export function useProjectDetail(project?: Project | null) {
  const [loading, setLoading] = React.useState(false);
  const [detail, setDetail] = React.useState<{
    project: Project | null;
    media: ProjectMedia[];
  } | null>(null);

  const ensureLoaded = React.useCallback(async () => {
    if (!project?.id || detail || loading) return;
    setLoading(true);
    try {
      const pjRes = await fetch(`/api/home/projects/${encodeURIComponent(project.id)}`, { cache: "no-store" });
      const pjJson = await pjRes.json().catch(() => ({}));

      const mdRes = await fetch(`/api/home/projects/${encodeURIComponent(project.id)}/media`, { cache: "no-store" });
      const mdJson = await mdRes.json().catch(() => ({}));
      let media: ProjectMedia[] = Array.isArray(mdJson?.media) ? mdJson.media : [];

      // Fallback to hero image if no media rows exist
      const heroUrl = pjJson?.project?.image_url || project?.image_url;
      if ((!media || media.length === 0) && heroUrl) {
        media = [
          {
            id: "hero",
            type: "image",
            url: heroUrl,
            caption: pjJson?.project?.title || project?.title || "",
            idx: 0,
          },
        ];
      }

      setDetail({
        project: pjJson?.project ?? project ?? null,
        media,
      });
    } catch (e) {
      console.error("[useProjectDetail] load error", e);
      setDetail({ project: project ?? null, media: [] });
    } finally {
      setLoading(false);
    }
  }, [project, detail, loading]);

  return { loading, detail, ensureLoaded };
}
