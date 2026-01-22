// src/components/blog/admin/posts/ManagePostsPage.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import PostRow from "./PostRow";
import { usePosts } from "./usePosts";
import { TABS, type Tab } from "./types";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// If you already have an admin navbar in v5, swap this import.
// You currently have blog Navbar components under src/components/blog/...
import NavbarClientShell from "@/components/blog/NavbarClientShell";

type MediaItem = { type?: string | null; url?: string | null; idx?: number | null };

function extractYouTubeId(url: string): string | undefined {
  const m =
    url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([0-9A-Za-z_-]{11})/) ||
    url.match(/[?&]v=([0-9A-Za-z_-]{11})/);

  if (m?.[1]) return m[1];

  try {
    const u = new URL(url);
    const v = u.searchParams.get("v");
    if (v && v.length >= 11) return v;

    const last = u.pathname.split("/").filter(Boolean).pop();
    if (last && last.length >= 11) return last;
  } catch {}

  return undefined;
}

function topMediaThumb(media?: MediaItem[] | null, fallback?: string | null) {
  const list = Array.isArray(media) ? media : [];

  // Respect idx ordering if present
  const sorted = [...list].sort((a, b) => (a?.idx ?? 0) - (b?.idx ?? 0));

  const first = sorted[0];
  const type = (first?.type ?? "").toLowerCase();
  const url = first?.url ?? "";

  if (type === "image" && url) return url;

  if (type === "youtube" && url) {
    const id = extractYouTubeId(url);
    if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }

  // Optional: if you store instagram type, you’ll need your own thumbnail strategy

  return fallback || "/logo192.png";
}


export default function ManagePostsPage() {
  const router = useRouter();
  const {
    filtered,
    loading,
    error,
    tab,
    setTab,
    q,
    setQ,
    fetchPosts,
    makePublic,
    makePrivate,
    makeDraft,
    archive,
    unarchive,
    del,
  } = usePosts();

  const rows = React.useMemo(
    () =>
      filtered.map((p: any) => ({
        ...p,
        __thumb: topMediaThumb(p.media, p.thumbnail_url),
      })),
    [filtered]
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavbarClientShell profile={null} />

      <main className="container mx-auto px-4 pt-24 pb-10">
        <Card className="border-border bg-background/60 backdrop-blur">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl sm:text-2xl font-semibold">
                Manage posts
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Filter, search, and update the status of your blog posts.
              </CardDescription>
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              <Button type="button" variant="outline" size="sm" onClick={fetchPosts}>
                Refresh
              </Button>

              <Button type="button" size="sm" onClick={() => router.push("/admin/posts/new")}>
                + New post
              </Button>

              <Button type="button" variant="ghost" size="sm" onClick={() => router.back()}>
                ← Back
              </Button>
            </div>
          </CardHeader>

          <Separator className="bg-border/60" />

          <CardContent className="pt-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Tabs (simple, no shadcn Tabs needed unless you want it) */}
              <div className="flex w-full sm:w-auto gap-1 rounded-lg border border-border bg-background/50 p-1">
                {TABS.map((t) => {
                  const active = tab === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTab(t as Tab)}
                      className={[
                        "px-3 py-1.5 text-xs sm:text-[13px] capitalize rounded-md transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                      ].join(" ")}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 flex justify-end">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search title, slug, excerpt…"
                  className="w-full sm:w-80 text-sm"
                />
              </div>
            </div>

            {error && <p className="mb-3 text-xs text-destructive">error: {error}</p>}

            <div className="rounded-xl border border-border/80 bg-background/60">
              {loading ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">Loading…</div>
              ) : rows.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">No posts found.</div>
              ) : (
                <ul className="divide-y divide-border/70">
                  {rows.map((p: any) => (
                    <PostRow
                      key={p.id}
                      post={p}
                      thumbUrl={p.__thumb}
                      onMakePublic={makePublic}
                      onMakePrivate={makePrivate}
                      onMakeDraft={makeDraft}
                      onArchive={archive}
                      onUnarchive={unarchive}
                      onDelete={del}
                      // v5 edit route (adjust to match your actual edit page)
                      editHref={(slug) => `/admin/posts/${slug}`}
                    />
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
