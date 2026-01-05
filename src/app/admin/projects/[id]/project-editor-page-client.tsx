// src/app/admin/projects/[id]/project-editor-page-client.tsx
"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import ProjectMediaManager from "@/app/admin/projects/[id]/components/ProjectMediaManager";

type ProjectStatus = "public" | "draft"; // ✅ private removed

type Project = {
  id: string;
  idx: number;
  title: string;
  slug: string | null;
  excerpt: string | null;
  href: string | null;
  color: string | null;

  // cover image chosen from media library
  image_url: string | null;

  content: string | null;
  status: ProjectStatus | "private"; // tolerate legacy values from DB
  created_at: string;
  updated_at: string;
};

const API_BASE = "/api/admin/projects";

function slugify(input: string) {
  return (input || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function normalizeStatus(s: any): ProjectStatus {
  return s === "public" ? "public" : "draft";
}

export default function ProjectEditorPageClient({ id }: { id: string }) {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [project, setProject] = React.useState<Project | null>(null);

  // editable fields (local draft)
  const [title, setTitle] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [excerpt, setExcerpt] = React.useState("");
  const [href, setHref] = React.useState("");
  const [color, setColor] = React.useState("#7C3AED");

  // cover image comes from media library selection
  const [imageUrl, setImageUrl] = React.useState<string>("");

  const [status, setStatus] = React.useState<ProjectStatus>("draft");
  const [content, setContent] = React.useState("");

  // for inserting embed snippets at cursor position
  const contentRef = React.useRef<HTMLTextAreaElement | null>(null);

  const insertSnippet = React.useCallback((snippet: string) => {
    const el = contentRef.current;
    const s = snippet.endsWith("\n") ? snippet : snippet + "\n";

    if (!el) {
      setContent((prev) => (prev ? prev + "\n\n" + s : s));
      return;
    }

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;

    setContent((prev) => {
      const before = prev.slice(0, start);
      const after = prev.slice(end);

      const needsLead = before && !before.endsWith("\n") ? "\n" : "";
      const needsTrail = after && !after.startsWith("\n") ? "\n" : "";

      return `${before}${needsLead}${s}${needsTrail}${after}`;
    });

    requestAnimationFrame(() => {
      const nextPos = start + s.length + (start > 0 ? 1 : 0);
      el.focus();
      el.setSelectionRange(nextPos, nextPos);
    });
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();

      const p: Project = json.project ?? json.data ?? json;
      setProject(p);

      setTitle(p.title ?? "");
      setSlug(p.slug ?? "");
      setExcerpt(p.excerpt ?? "");
      setHref(p.href ?? "");
      setColor(p.color ?? "#7C3AED");
      setImageUrl(p.image_url ?? "");
      setStatus(normalizeStatus(p.status));
      setContent(p.content ?? ""); // keep raw exactly as stored
    } catch (e: any) {
      setError(e?.message || "Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!project) return;
    setSaving(true);
    setError(null);
    try {
      const patch = {
        title: title.trim(),
        slug: slug.trim() ? slug.trim() : null,
        excerpt: excerpt.trim() ? excerpt.trim() : null,
        href: href.trim() ? href.trim() : null,
        color: color || null,

        // ✅ cover selected via media library only
        image_url: imageUrl.trim() ? imageUrl.trim() : null,

        status,
        content, // save raw
      };

      const res = await fetch(`${API_BASE}/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const onAutoSlug = () => setSlug(slugify(title));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {loading ? "Edit Project" : project?.title || "Edit Project"}
            </h1>
            {!loading && project ? (
              <Badge variant="outline" className="capitalize text-white">
                {normalizeStatus(project.status)}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Edit metadata, content, and project media.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="bg-black text-white" asChild>
            <Link href="/admin/projects">← Back</Link>
          </Button>
          <Button variant="outline" className="bg-black text-white" onClick={load} disabled={loading || saving}>
            Refresh
          </Button>
          <Button onClick={save} className="bg-black text-white border border-white hover:bg-white hover:text-black" disabled={loading || saving || !project}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <Separator className="my-6" />
      {error ? <div className="mb-4 text-sm text-destructive">{error}</div> : null}

      {loading ? (
        <Card className="p-6 space-y-4">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-24 w-full" />
        </Card>
      ) : !project ? (
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">Project not found.</div>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* LEFT: Meta */}
          <Card className="p-6 lg:col-span-4 bg-black text-white space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="slug">Slug</Label>
                <Button type="button" className="bg-black text-white hover:bg-white hover:text-black border border-white" size="sm" variant="secondary" onClick={onAutoSlug}>
                  Auto
                </Button>
              </div>
              <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                URL: <span className="font-mono">/projects/{slug || project.id}</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="excerpt">Excerpt</Label>
              <Textarea
                id="excerpt"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="href">External Link</Label>
              <Input id="href" value={href} onChange={(e) => setHref(e.target.value)} />
            </div>

            {/* ✅ Cover is selected from media library (no URL input) */}
            <div className="space-y-2">
              <Label>Cover image</Label>
              {imageUrl ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Cover"
                    className="h-12 w-12 rounded-md object-cover border bg-muted"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/logo192.png";
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground truncate font-mono">
                      {imageUrl}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Set from Media Library → “Set cover”
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-black text-white border border-white hover:bg-white hover:text-black"
                    onClick={() => setImageUrl("")}
                  >
                    Clear
                  </Button>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  No cover selected. Choose one from the Media Library.
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">draft</SelectItem>
                    <SelectItem value="public">public</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="color">Accent</Label>
                <Input
                  id="color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 p-1"
                />
              </div>
            </div>

            <Separator />

            <div className="text-xs text-muted-foreground space-y-1">
              <div>
                <span className="font-medium">ID:</span>{" "}
                <span className="font-mono">{project.id}</span>
              </div>
              <div>
                <span className="font-medium">Created:</span>{" "}
                {new Date(project.created_at).toLocaleString()}
              </div>
              <div>
                <span className="font-medium">Updated:</span>{" "}
                {new Date(project.updated_at).toLocaleString()}
              </div>
            </div>
          </Card>

          {/* RIGHT: Content + Media */}
          <div className="lg:col-span-8 space-y-6">
            {/* Content */}
            <Card className="p-6 bg-black text-white space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Content</h2>
                  <p className="text-sm text-muted-foreground">
                    Stored in <span className="font-mono">home_projects.content</span> (raw).
                  </p>
                </div>
                <Button variant="secondary" onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>

              <Textarea
                ref={contentRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={18}
                placeholder="Write project content here (HTML/raw)…"
                className="font-mono text-sm"
              />

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Tip: use Media → Embed buttons to insert snippets into content.</span>
                <span>{content.length} chars</span>
              </div>
            </Card>

            {/* Media Manager */}
            <ProjectMediaManager
              projectId={id}
              onEmbed={(snippet: string) => insertSnippet(snippet)}
              onSetCover={(url: string) => setImageUrl(url)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
