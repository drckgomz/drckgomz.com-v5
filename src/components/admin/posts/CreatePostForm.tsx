// src/components/blog/admin/posts/CreatePostForm.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CreatePostForm() {
  const router = useRouter();

  const titleInput = React.useRef<HTMLInputElement>(null);
  const slugInput = React.useRef<HTMLInputElement>(null);
  const excerptInput = React.useRef<HTMLTextAreaElement>(null);
  const hydrated = React.useSyncExternalStore(() => () => undefined, () => true, () => false);
  const [creating, setCreating] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // Keep the slug suggestion directly in the DOM so the form doesn't depend
  // on a debounced state/render cycle during submit.
  const slugTouchedRef = React.useRef(false);

  const creatingRef = React.useRef(false);
  async function onCreate() {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setErr(null);
    setCreating(true);

    try {
      const payload = {
        title: titleInput.current?.value.trim() ?? "",
        slug: slugInput.current?.value.trim() ?? "",
        excerpt: excerptInput.current?.value.trim() || null,
      };

      if (!payload.title) throw new Error("Title is required.");
      if (!payload.slug) throw new Error("Slug is required.");

      const res = await fetch("/api/admin/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Create failed (${res.status})`);

      const nextSlug = json?.post?.slug || payload.slug;

      router.push(`/admin/posts/${encodeURIComponent(nextSlug)}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to create post.");
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }

  return (
    <div data-testid="create-post-form" data-hydrated={hydrated ? "true" : "false"} className="post-publishing min-w-0 space-y-5">
      {err ? (
        <div role="alert" className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-destructive">
          {err}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="new-title" className="text-xs font-medium text-foreground/80">Title</label>
          <Input id="new-title" maxLength={240}
            ref={titleInput}
            defaultValue=""
            onInput={(e) => { if (!slugTouchedRef.current && slugInput.current) slugInput.current.value = slugify(e.currentTarget.value); }}
            placeholder="My new post…"
            className="border-border bg-muted/40 text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="new-slug" className="text-xs font-medium text-foreground/80">Slug</label>
          <Input id="new-slug" maxLength={240}
            ref={slugInput}
            defaultValue=""
            onInput={() => {
              slugTouchedRef.current = true;
            }}
            onBlur={(e) => { e.currentTarget.value = slugify(e.currentTarget.value); }}
            placeholder="my-new-post"
            className="border-border bg-muted/40 text-foreground placeholder:text-muted-foreground"
          />
          <p className="text-[11px] text-muted-foreground">Use lowercase letters, numbers, and hyphens.</p>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="new-excerpt" className="text-xs font-medium text-foreground/80">Excerpt</label>
        <Textarea id="new-excerpt" maxLength={2000}
          ref={excerptInput}
          defaultValue=""
          rows={4}
          placeholder="Short summary that appears on the blog list…"
          className="border-border bg-muted/40 text-foreground placeholder:text-muted-foreground"
        />
        <p className="text-[11px] text-muted-foreground">Tip: 1–2 sentences reads best on the feed.</p>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
        <Button
          type="button"
          variant="ghost"
          className="bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={() => router.back()}
          disabled={!hydrated || creating}
        >
          Cancel
        </Button>

        <Button
          type="button"
          className="bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={onCreate}
          disabled={!hydrated || creating}
        >
          {creating ? "Creating…" : "Create & edit"}
        </Button>
      </div>
    </div>
  );
}
