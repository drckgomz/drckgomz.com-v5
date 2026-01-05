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
  status?: string | null;
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
      const id = encodeURIComponent(project.id);

      const pjRes = await fetch(`/api/home/projects/${id}`, { cache: "no-store" });
      const pjJson = await pjRes.json().catch(() => ({}));

      const mdRes = await fetch(`/api/home/projects/${id}/media`, { cache: "no-store" });
      const mdJson = await mdRes.json().catch(() => ({}));
      let media: ProjectMedia[] = Array.isArray(mdJson?.media) ? mdJson.media : [];

      // Prefer the fetched project (it includes color/content/status/etc)
      const fetchedProject: Project | null = pjJson?.project ?? null;

      // Fallback to hero image if no media rows exist
      const heroUrl = fetchedProject?.image_url || project?.image_url;
      if ((!media || media.length === 0) && heroUrl) {
        media = [
          {
            id: "hero",
            type: "image",
            url: heroUrl,
            caption: fetchedProject?.title || project?.title || "",
            idx: 0,
          },
        ];
      }



      setDetail({
        project: fetchedProject ?? project ?? null,
        media,
      });
    } catch (e) {
      console.error("[useProjectDetail] load error", e);
      setDetail({ project: project ?? null, media: [] });
    } finally {
      setLoading(false);
    }
  }, [project, detail, loading]);

      React.useEffect(() => {
        ensureLoaded();
      }, [ensureLoaded]);

  return { loading, detail, ensureLoaded };
}
