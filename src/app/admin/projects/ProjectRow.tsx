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
  switch (status) {
    case "public":
      return "default";
    case "draft":
      return "outline";
  }
}

function getThumb(p: Project) {
  // cover is stored in home_projects.image_url (set from media library)
  return p.image_url || "https://derickgomez-images.s3.us-east-1.amazonaws.com/logo192.png";
}

export default function ProjectRow({
  project: p,
  onSetStatus,
  onDelete,
}: {
  project: Project;
  onSetStatus: (id: string, status: ProjectStatus) => void;
  onDelete: (id: string) => void;
}) {
  const thumb = getThumb(p);

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumb}
          alt={`${p.title || p.slug || "project"} thumbnail`}
          className="h-14 w-14 rounded-lg object-cover border bg-muted"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/logo192.png";
          }}
        />

        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="truncate font-semibold">{p.title || "(untitled)"}</div>
            <Badge variant={statusVariant(p.status)} className="bg-black text-white border border-white capitalize">
              {p.status}
            </Badge>
          </div>

          <div className="truncate text-xs text-muted-foreground">
            <span className="mr-2">/projects/{p.slug || p.id}</span>
            {p.updated_at ? (
              <span>• updated {new Date(p.updated_at).toLocaleString()}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button asChild variant="secondary" className="bg-white border border-white hover:bg-black hover:text-white" size="sm">
          <Link href={`/admin/projects/${p.id}`}>Edit</Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="bg-black" size="sm">
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
