// src/app/admin/projects/[id]/components/ProjectMediaManager.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

export type ProjectMediaType = "image" | "youtube" | "instagram" | "video" | "file";

export type ProjectMedia = {
  id: string;
  project_id: string;
  type: ProjectMediaType;
  url: string;
  caption: string | null;
  idx: number | null;
  meta: any;
  created_at: string;
};

const mediaApi = (projectId: string) => `/api/admin/projects/${projectId}/media`;
const presignApi = `/api/admin/uploads/presign`;
const projectApi = (projectId: string) => `/api/admin/projects/${projectId}`;

// IMPORTANT: keep this consistent with how your presign route returns `key`
const MEDIA_BASE = (process.env.NEXT_PUBLIC_S3_MEDIA_BASE || "").replace(/\/$/, "");

function safeFilename(name: string) {
  return name.replace(/[^\w.\-]+/g, "-");
}

function parseYouTubeEmbed(url: string) {
  const u = url.trim();
  try {
    const parsed = new URL(u);
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      const parts = parsed.pathname.split("/").filter(Boolean);
      const idx = parts.indexOf("embed");
      if (idx >= 0 && parts[idx + 1]) return `https://www.youtube.com/embed/${parts[idx + 1]}`;
    }
  } catch {}
  return null;
}

export default function ProjectMediaManager({
  projectId,
  onEmbed,
  onSetCover,
}: {
  projectId: string;
  onEmbed: (snippet: string) => void;
  onSetCover?: (url: string) => void;
}) {
  const [media, setMedia] = React.useState<ProjectMedia[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [ytUrl, setYtUrl] = React.useState("");
  const [videoUrl, setVideoUrl] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(mediaApi(projectId), { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setMedia(Array.isArray(json?.media) ? json.media : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load media");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);

    try {
      const uploaded: Array<{
        type: ProjectMediaType;
        url: string;
        caption: string | null;
        idx: number | null;
        meta: any;
      }> = [];

      for (const file of Array.from(files)) {
        const filename = safeFilename(file.name);

        // 1) presign (route decides final key; we pass scope + projectId)
        const pres = await fetch(presignApi, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            scope: "projects",
            projectId,
            filename,
            contentType: file.type || "application/octet-stream",
          }),
        });

        if (!pres.ok) throw new Error(await pres.text());
        const { url, key } = (await pres.json()) as { url: string; key: string };

        // 2) upload to S3
        const put = await fetch(url, {
          method: "PUT",
          headers: { "content-type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!put.ok) throw new Error(`S3 upload failed: ${put.status}`);

        // 3) record in db
        const publicUrl = key.startsWith("http") ? key : `${MEDIA_BASE}/${key}`;
        uploaded.push({
          type: file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "file",
          url: publicUrl,
          caption: null,
          idx: null,
          meta: { name: file.name, size: file.size, type: file.type, key },
        });
      }

      const ins = await fetch(mediaApi(projectId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: uploaded, mode: "append" }),
      });
      if (!ins.ok) throw new Error(await ins.text());

      await load();
    } catch (e: any) {
      setError(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function patchMedia(mediaId: string, patch: Partial<ProjectMedia>) {
    const res = await fetch(`${mediaApi(projectId)}/${mediaId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async function remove(mediaId: string) {
    if (!confirm("Remove this media item?")) return;
    const res = await fetch(`${mediaApi(projectId)}/${mediaId}`, { method: "DELETE" });
    if (!res.ok) return alert(await res.text());
    setMedia((prev) => prev.filter((m) => m.id !== mediaId));
  }

  function embedMarkdownImage(m: ProjectMedia) {
    const cap = (m.caption ?? "").trim();
    onEmbed(`![${cap}](${m.url})`);
  }

  function embedHtmlFigure(m: ProjectMedia) {
    const cap = (m.caption ?? "").trim();
    onEmbed(`<figure><img src="${m.url}" alt="${cap}"/><figcaption>${cap}</figcaption></figure>`);
  }

  function embedVideoTag(url: string) {
    onEmbed(`<video controls src="${url}"></video>`);
  }

  function embedYouTube(url: string) {
    const embed = parseYouTubeEmbed(url);
    if (!embed) return alert("Paste a valid YouTube URL");
    onEmbed(
      `<iframe width="560" height="315" src="${embed}" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
    );
  }

  async function setCover(url: string) {
    try {
      // update UI state immediately
      onSetCover?.(url);

      // persist immediately too (so you don't have to hit Save)
      const res = await fetch(projectApi(projectId), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image_url: url }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e: any) {
      alert(e?.message || "Failed to set cover");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-black text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Project media</h3>
              {busy ? <Badge variant="secondary">Uploading…</Badge> : null}
            </div>
            <p className="text-xs text-muted-foreground">
              DB: <span className="font-mono">home_project_media</span> • S3:{" "}
              <span className="font-mono">s3://derickgomez-images/projects/</span>
            </p>
          </div>
          <Button variant="outline" className="bg-black text-white border border-white hover:bg-white hover:text-black" size="sm" onClick={load} disabled={busy}>
            Refresh
          </Button>
        </div>

        <Separator className="my-4" />

        {error ? <div className="mb-3 text-sm text-destructive">{error}</div> : null}

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="secondary" className="bg-black text-white border border-white hover:bg-white hover:text-black" size="sm">
              <label className="cursor-pointer">
                {busy ? "Uploading…" : "Upload to S3"}
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => uploadFiles(e.currentTarget.files)}
                />
              </label>
            </Button>

            <div className="flex items-center gap-2">
              <Input
                value={ytUrl}
                onChange={(e) => setYtUrl(e.target.value)}
                placeholder="YouTube URL…"
                className="w-72"
              />
              <Button
                size="sm"
                variant="outline"
                className="bg-black text-white border border-white hover:bg-white hover:text-black"
                onClick={() => {
                  if (!ytUrl.trim()) return;
                  embedYouTube(ytUrl);
                  setYtUrl("");
                }}
              >
                Embed
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Video URL (mp4/webm)…"
                className="w-72"
              />
              <Button
                size="sm"
                variant="outline"
                className="bg-black text-white border border-white hover:bg-white hover:text-black"
                onClick={() => {
                  if (!videoUrl.trim()) return;
                  embedVideoTag(videoUrl.trim());
                  setVideoUrl("");
                }}
              >
                Embed
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Embed custom snippet</Label>
            <Textarea rows={3} placeholder="Paste any HTML/markdown snippet here…" id="custom-snippet" />
            <Button
              size="sm"
              variant="outline"
              className="bg-black text-white border border-white hover:bg-white hover:text-black"
              onClick={() => {
                const el = document.getElementById("custom-snippet") as HTMLTextAreaElement | null;
                const v = el?.value ?? "";
                if (!v.trim()) return;
                onEmbed(v.trim());
                if (el) el.value = "";
              }}
            >
              Insert into content
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-black text-white border border-white">
        <div className="flex items-center  justify-between">
          <div className="text-sm font-semibold">Media library</div>
          <div className="text-xs text-muted-foreground">
            {loading ? "Loading…" : `${media.length} item(s)`}
          </div>
        </div>

        <Separator className="my-4" />

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading media…</div>
        ) : media.length === 0 ? (
          <div className="text-sm text-muted-foreground">No media yet.</div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {media.map((m) => (
              <li key={m.id} className="space-y-2">
                {m.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.url}
                    alt={m.caption ?? "media"}
                    className="h-28 w-full rounded-md object-cover border bg-muted"
                    onError={(e) =>
                      ((e.currentTarget as HTMLImageElement).src = "/logo192.png")
                    }
                  />
                ) : (
                  <div className="h-28 w-full rounded-md border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                    {m.type.toUpperCase()}
                  </div>
                )}

                <Input
                  defaultValue={m.caption ?? ""}
                  placeholder="Caption…"
                  onBlur={async (e) => {
                    const next = e.currentTarget.value.trim();
                    const val = next ? next : null;
                    if ((m.caption ?? null) === val) return;

                    try {
                      await patchMedia(m.id, { caption: val } as any);
                      setMedia((prev) =>
                        prev.map((x) => (x.id === m.id ? { ...x, caption: val } : x))
                      );
                    } catch {
                      // ignore
                    }
                  }}
                />

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="bg-black text-white border border-white hover:bg-white hover:text-black" variant="secondary" onClick={() => embedMarkdownImage(m)}>
                    Embed MD
                  </Button>
                  <Button size="sm" className="bg-black text-white border border-white hover:bg-white hover:text-black" variant="outline" onClick={() => embedHtmlFigure(m)}>
                    Embed HTML
                  </Button>

                  {m.type === "image" && onSetCover ? (
                    <Button size="sm" className="bg-black text-white border border-white hover:bg-white hover:text-black" variant="outline" onClick={() => setCover(m.url)}>
                      Set cover
                    </Button>
                  ) : null}

                  <Button size="sm" variant="destructive" onClick={() => remove(m.id)}>
                    Remove
                  </Button>
                </div>

                <div className="text-[11px] text-muted-foreground truncate">
                  <span className="font-mono">{m.type}</span> • {m.url}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
