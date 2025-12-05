// src/components/home/sections/project/ProjectTile.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import TileThumb from "@/components/home/sections/project/TileThumb";
import type { Project as ProjectFull } from "@/components/home/sections/project/lib/types";

export type ProjectCard =
  Pick<ProjectFull, "id" | "title" | "slug" | "excerpt" | "color" | "image_url"> & {
    display_thumb_url?: string | null;
  } & Partial<Pick<ProjectFull, "idx" | "href" | "content" | "status">>;

type Props = { project: ProjectCard };

export default function ProjectTile({ project }: Props) {
  const label = project?.title || "Untitled";
  const color = project?.color || "#7C3AED";
  const thumb = project.display_thumb_url || project.image_url || null;
  const excerpt = project?.excerpt || "";

  // 🔑 Always use the ID for now
  const href = `/projects/${encodeURIComponent(project.id)}`;

  return (
    <Link
      href={href}
      className="
        block rounded-2xl
        focus-visible:outline-none
        focus-visible:ring-2 focus-visible:ring-white/60
      "
      aria-label={`Open project: ${label}`}
    >
      <TileThumb label={label} color={color} thumb={thumb} excerpt={excerpt} />
    </Link>
  );
}
