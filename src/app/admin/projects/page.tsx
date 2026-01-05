// src/app/admin/projects/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";

import { useProjects } from "./useProjects";
import ProjectRow from "./ProjectRow";
import { TABS } from "./types";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminProjectsPage() {
  const {
    filtered,
    loading,
    error,
    tab,
    setTab,
    q,
    setQ,
    fetchProjects,
    setStatus,
    del,
  } = useProjects();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Manage Projects</h1>
          <p className="text-sm text-muted-foreground">
            Create, publish, and manage project entries shown across the site.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button className="bg-black" variant="outline" onClick={fetchProjects}>
            Refresh
          </Button>

          <Button asChild>
            <Link href="/admin/projects/new">+ New Project</Link>
          </Button>
        </div>
      </div>

      <Separator className="my-6" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={tab === t ? "default" : "secondary"}
              className="capitalize"
              onClick={() => setTab(t)}
            >
              {t}
            </Button>
          ))}
        </div>

        <div className="sm:ml-auto sm:w-80">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, slug, excerpt…"
          />
        </div>
      </div>

      {error ? (
        <div className="mt-4 text-sm text-destructive">error: {error}</div>
      ) : null}

      <Card className="mt-5 p-4">
        {loading ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-14 w-14 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
            <Skeleton className="h-px w-full" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-14 w-14 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground">No projects found.</div>
        ) : (
          <ul className="divide-y">
            {filtered.map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                onSetStatus={setStatus}
                onDelete={del}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
