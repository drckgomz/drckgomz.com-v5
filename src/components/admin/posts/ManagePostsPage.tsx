// src/components/admin/posts/ManagePostsPage.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { getYouTubeVideoId } from "@/lib/blog/media";
import PostRow from "@/components/admin/posts/PostRow";
import { selectPostThumbnail } from "@/components/admin/posts/thumbnail";
import { usePosts } from "@/components/admin/posts/usePosts";
import { TABS, type Tab } from "@/components/admin/posts/types";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/utils";

type MediaItem = { type?: string | null; url?: string | null; idx?: number | null };

function topMediaThumb(media?: MediaItem[] | null, fallback?: string | null) {
  return selectPostThumbnail(media, fallback, getYouTubeVideoId);
}

export default function ManagePostsPage() {
  const router = useRouter();
  const {
    page, setPage, hasMore, pendingSlug,
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
    duplicate,
  } = usePosts();

  const rows = React.useMemo(
    () =>
      filtered.map((p) => ({
        ...p,
        __thumb: topMediaThumb(p.media, p.thumbnail_url),
      })),
    [filtered]
  );

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="pt-5 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          {/* Header row (matches Edit Post page vibe) */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold">Manage Posts</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Filter, search, and update the status of your blog posts.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                className="bg-muted/40 text-foreground border border-border hover:bg-accent hover:text-accent-foreground"
                onClick={fetchPosts}
              >
                Refresh
              </Button>

              <Button
                type="button"
                className="bg-muted/40 text-foreground border border-border hover:bg-accent hover:text-accent-foreground"
                onClick={() => router.push("/admin/posts/new")}
              >
                + New post
              </Button>

              <Button
                type="button"
                variant="secondary"
                className="bg-muted/40 text-foreground border border-border hover:bg-accent hover:text-accent-foreground"
                onClick={() => router.back()}
              >
                ← Back
              </Button>
            </div>
          </div>

          {/* Main surface card (same as EditPostPage Card) */}
          <Card className="rounded-2xl border border-border bg-muted/40">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-foreground">
                Posts
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Choose a tab, search, then edit or change status.
              </CardDescription>
            </CardHeader>

            <Separator className="bg-muted" />

            <CardContent className="pt-4">
              {/* Tabs + search row */}
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap w-full sm:w-auto gap-1 rounded-xl border border-border bg-muted/40 p-1">
                  {TABS.map((t) => {
                    const active = tab === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={pendingSlug !== null}
                        aria-pressed={active}
                        onClick={() => setTab(t as Tab)}
                        className={cn(
                          "px-3 py-1.5 text-xs capitalize rounded-lg transition-colors",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground/80 hover:bg-muted hover:text-foreground"
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
                    aria-label="Search all posts by title, slug or excerpt"
                    placeholder="Search all posts…"
                    className={cn(
                      "h-9 text-sm",
                      "bg-muted/40 border border-border text-foreground",
                      "placeholder:text-muted-foreground",
                      "focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                  />
                </div>
              </div>

              {error ? (
                <div role="alert" className="mb-3 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-destructive">
                  error: {error}
                </div>
              ) : null}

              {/* List surface (matches editor/media list cards) */}
              <div className="rounded-2xl border border-border bg-muted/40 overflow-hidden">
                {loading ? (
                  <div role="status" className="px-4 py-6 text-sm text-muted-foreground">Loading…</div>
                ) : rows.length === 0 ? (
                  <div role="status" className="px-4 py-6 text-sm text-muted-foreground">No posts found.</div>
                ) : (
                  <ul className="divide-y divide-border">
                    {rows.map((p) => (
                      <PostRow
                        busy={pendingSlug !== null}
                        key={p.id}
                        post={p}
                        thumbUrl={p.__thumb}
                        onMakePublic={makePublic}
                        onMakePrivate={makePrivate}
                        onMakeDraft={makeDraft}
                        onArchive={archive}
                        onUnarchive={unarchive}
                        onDelete={del}
                        onDuplicate={(slug) => { void duplicate(slug).then(copy => { if (copy) router.push(`/admin/posts/${encodeURIComponent(copy)}`); }); }}
                        editHref={(slug) => `/admin/posts/${encodeURIComponent(slug)}`}
                      />
                    ))}
                  </ul>
                )}
              </div>
              <nav aria-label="Post list pages" className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <Button type="button" variant="outline" disabled={page === 0 || loading || pendingSlug !== null} onClick={() => setPage(page - 1)}>Previous page</Button>
                <span role="status">Page {page + 1} · Search covers all posts</span>
                <Button type="button" variant="outline" disabled={!hasMore || loading || pendingSlug !== null} onClick={() => setPage(page + 1)}>Next page</Button>
              </nav>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
