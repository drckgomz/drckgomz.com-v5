// src/app/admin/projects/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";

import { useProjects } from "./useProjects";
import ProjectRow from "./ProjectRow";
import { TABS, type Tab } from "./types";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/utils";

export default function AdminProjectsPage() {
  const { filtered, loading, error, tab, setTab, q, setQ, fetchProjects, setStatus, del } =
    useProjects();

  return (
    <main className="min-h-dvh bg-black text-white">
      <div className="pt-5 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          {/* Header row (matches ManagePostsPage) */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold">Manage Projects</h1>
              <p className="mt-1 text-xs text-white/60">
                Filter, search, and update the status of your projects.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                className="bg-white/5 text-white border border-white/25 hover:bg-white hover:text-black"
                onClick={fetchProjects}
              >
                Refresh
              </Button>

              <Button
                type="button"
                className="bg-white/5 text-white border border-white/25 hover:bg-white hover:text-black"
                asChild
              >
                <Link href="/admin/projects/new">+ New project</Link>
              </Button>

              <Button
                type="button"
                variant="secondary"
                className="bg-white/5 text-white border border-white/25 hover:bg-white hover:text-black"
                asChild
              >
                <Link href="/admin">← Back</Link>
              </Button>
            </div>
          </div>

          {/* Main surface card */}
          <Card className="rounded-2xl border border-white/10 bg-white/5">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-white">Projects</CardTitle>
              <CardDescription className="text-xs text-white/60">
                Choose a tab, search, then edit or change status.
              </CardDescription>
            </CardHeader>

            <Separator className="bg-white/10" />

            <CardContent className="pt-4">
              {/* Tabs + search row */}
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex w-full sm:w-auto gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
                  {TABS.map((t) => {
                    const active = tab === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTab(t as Tab)}
                        className={cn(
                          "px-3 py-1.5 text-xs capitalize rounded-lg transition-colors",
                          active
                            ? "bg-white text-black"
                            : "text-white/70 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>

                <div className="w-full sm:w-[360px]">
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search title, slug, excerpt…"
                    className={cn(
                      "h-9 text-sm",
                      "bg-white/5 border border-white/10 text-white",
                      "placeholder:text-white/40",
                      "focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                  />
                </div>
              </div>

              {error ? (
                <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  error: {error}
                </div>
              ) : null}

              {/* List surface */}
              <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                {loading ? (
                  <div className="px-4 py-6 text-sm text-white/60">Loading…</div>
                ) : filtered.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-white/60">No projects found.</div>
                ) : (
                  <ul className="divide-y divide-white/10">
                    {filtered.map((p) => (
                      <ProjectRow
                        key={p.id}
                        project={p}
                        onSetStatus={setStatus}
                        onDelete={del}
                        editHref={(id) => `/admin/projects/${id}`}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
