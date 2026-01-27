// src/app/admin/projects/ProjectRow.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import type { Project, ProjectStatus } from "./types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function statusVariant(status: ProjectStatus) {
  // match posts vibe (outline-ish + dark surface)
  if (status === "public") return "outline";
  return "secondary";
}

function getThumb(p: Project) {
  return p.image_url || "/logo192.png";
}

export default function ProjectRow({
  project: p,
  onSetStatus,
  onDelete,
  editHref = (id) => `/admin/projects/${id}`,
}: {
  project: Project;
  onSetStatus: (id: string, status: ProjectStatus) => void;
  onDelete: (id: string) => void;
  editHref?: (id: string) => string;
}) {
  const thumb = getThumb(p);

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumb}
          alt={`${p.title || p.slug || "project"} thumbnail`}
          className="h-14 w-14 shrink-0 rounded-lg object-cover border border-white/10 bg-black"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/logo192.png";
          }}
        />

        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="truncate font-semibold text-white">
              {p.title || "(untitled)"}
            </div>

            <Badge
              variant={statusVariant(p.status)}
              className="uppercase text-[10px] bg-black tracking-wide border-white text-white"
            >
              {p.status}
            </Badge>
          </div>

          <div className="truncate text-xs text-white/60">
            <span className="mr-2">/projects/{p.slug || p.id}</span>
            {p.updated_at ? (
              <span>• updated {new Date(p.updated_at).toLocaleString()}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Button
          asChild
          size="sm"
          className="bg-white/5 text-white border border-white/25 hover:bg-white hover:text-black"
        >
          <Link href={editHref(p.id)}>Edit</Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/5 text-white border border-white/25 hover:bg-white hover:text-black"
            >
              Actions
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Status</DropdownMenuLabel>

            <DropdownMenuItem
              disabled={p.status === "public"}
              onClick={() => onSetStatus(p.id, "public")}
            >
              Make public
            </DropdownMenuItem>

            <DropdownMenuItem
              disabled={p.status === "draft"}
              onClick={() => onSetStatus(p.id, "draft")}
            >
              Make draft
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(p.id)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
