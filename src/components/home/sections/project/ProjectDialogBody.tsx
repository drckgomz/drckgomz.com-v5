// frontend/src/features/home/components/project/ProjectDialogBody.tsx
"use client";
import * as React from "react";
import InlineCarousel from "@/components/home/sections/project/InlineCarousel";
import type { Project } from "@/components/home/sections/project/useProjectDetail";

export default function ProjectDialogBody({
  loading,
  media,
  project,
}: {
  loading: boolean;
  media: any[];
  project: Project | null | undefined;
}) {
  return (
    <div className="space-y-5">
      {/* Media carousel */}
      {loading ? (
        <div className="w-full aspect-video rounded-lg border border-white/10 bg-white/10 animate-pulse" />
      ) : media?.length ? (
        <InlineCarousel media={media} />
      ) : (
        <div className="text-sm text-white/80 italic">No media yet.</div>
      )}

      {/* External link */}
      {project?.href ? (
        <a
          href={project.href}
          target="_blank"
          rel="noreferrer"
          className="
            inline-flex items-center gap-2
            px-4 py-2 rounded-md
            bg-cyan-500 hover:bg-cyan-400
            text-black font-semibold
            ring-1 ring-black/10
            transition-colors
          "
        >
          Visit project ↗
        </a>
      ) : (
        <div className="text-xs text-white/70">No external link provided.</div>
      )}

      {/* Long content (HTML string) */}
      {project?.content ? (
        <div
          className="
            prose prose-invert max-w-none
            prose-headings:text-white 
            prose-p:text-white 
            prose-strong:text-white
            prose-a:text-cyan-300 hover:prose-a:text-cyan-200
          "
          dangerouslySetInnerHTML={{ __html: project.content }}
        />
      ) : (
        <p className="text-white/90 text-sm">More info coming soon.</p>
      )}
    </div>
  );
}
