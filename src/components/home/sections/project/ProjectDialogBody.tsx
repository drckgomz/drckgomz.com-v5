// src/components/home/sections/project/ProjectDialogBody.tsx
"use client";

import * as React from "react";
import InlineCarousel from "@/components/home/sections/project/InlineCarousel";
import type { Project } from "@/components/home/sections/project/useProjectDetail";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

function hexToRgba(input: string, alphaOverride?: number) {
  const raw = (input ?? "").trim();
  if (/^rgba?\(/i.test(raw)) {
    if (alphaOverride == null) return raw;
    const nums = raw
      .replace(/[^\d.,]/g, "")
      .split(",")
      .map((x) => Number(x.trim()));
    if (nums.length >= 3) {
      const [r, g, b] = nums;
      return `rgba(${r}, ${g}, ${b}, ${alphaOverride})`;
    }
  }

  let h = raw.startsWith("#") ? raw.slice(1) : raw;
  h = h.trim();
  if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6 && h.length !== 8) {
    const a = alphaOverride ?? 1;
    return `rgba(34, 211, 238, ${a})`;
  }

  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);

  let aFromHex = 1;
  if (h.length === 8) aFromHex = parseInt(h.slice(6, 8), 16) / 255;
  const a = alphaOverride ?? aFromHex;

  if (![r, g, b, a].every((n) => Number.isFinite(n))) {
    const a2 = alphaOverride ?? 1;
    return `rgba(34, 211, 238, ${a2})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export default function ProjectDialogBody({
  loading,
  media,
  project,
}: {
  loading: boolean;
  media: any[];
  project: Project | null | undefined;
}) {
  const html = React.useMemo(() => {
    return (project?.content ?? "").replace(/\r\n/g, "\n");
  }, [project?.content]);

  const accent = React.useMemo(() => {
    const c = (project?.color ?? "").trim();
    if (!c) return "#22d3ee";
    if (/^[0-9a-f]{3,8}$/i.test(c)) return `#${c}`;
    return c;
  }, [project?.color]);

  const accentGlow = hexToRgba(accent, 0.35);
  const accentBorder = hexToRgba(accent, 0.85);

  // ✅ Lightbox state for embedded images in HTML content
  const [openImg, setOpenImg] = React.useState(false);
  const [imgSrc, setImgSrc] = React.useState<string | null>(null);
  const [imgAlt, setImgAlt] = React.useState<string>("");

  const onContentClickCapture = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;

      const container = e.currentTarget;
      const target = e.target as Element | null;
      if (!target) return;

      let el: Element | null = target;
      let img: HTMLImageElement | null = null;

      while (el && el !== container) {
        if (el.tagName === "IMG") {
          img = el as HTMLImageElement;
          break;
        }

        const found = el.querySelector?.("img");
        if (found instanceof HTMLImageElement) {
          img = found;
          break;
        }

        el = el.parentElement;
      }

      if (!img) return;

      const src = img.currentSrc || img.getAttribute("src") || "";
      if (!src) return;

      const link = img.closest?.("a") as HTMLAnchorElement | null;
      if (link) {
        e.preventDefault();
        e.stopPropagation();
      }

      setImgSrc(src);
      setImgAlt(img.alt || "");
      setOpenImg(true);
    },
    []
  );

  return (
    <div className="space-y-5">
      {/* ✅ Embedded content image viewer (CENTERED modal) */}
      <Dialog
        open={openImg}
        onOpenChange={(v) => {
          setOpenImg(v);
          if (!v) {
            setImgSrc(null);
            setImgAlt("");
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="
            border-0 bg-black/90 p-0 overflow-hidden
            w-[96vw] max-w-[1100px]
            max-h-[85vh]
            rounded-none sm:rounded-2xl
          "
        >
          <DialogTitle className="sr-only">
            {imgAlt ? `Image: ${imgAlt}` : "Image preview"}
          </DialogTitle>

          <div className="relative w-full h-full">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setOpenImg(false)}
              className="
                absolute z-50
                h-11 w-11
                rounded-full
                bg-black/55 hover:bg-black/75
                text-white
                ring-1 ring-white/15
                backdrop-blur
                pointer-events-auto
                touch-manipulation
              "
              style={{
                top: "calc(env(safe-area-inset-top, 0px) + 12px)",
                right: "calc(env(safe-area-inset-right, 0px) + 12px)",
              }}
              aria-label="Close image preview"
            >
              <X className="h-5 w-5" />
            </Button>

            <div className="flex h-full w-full items-center justify-center p-4 sm:p-6">
              {imgSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imgSrc}
                  alt={imgAlt}
                  draggable={false}
                  className="max-h-[80vh] max-w-full object-contain select-none"
                />
              ) : (
                <div className="text-white/80 text-sm">No image selected.</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Media carousel */}
      {loading ? (
        <div className="w-full aspect-video rounded-lg border border-white bg-white/10 animate-pulse" />
      ) : media?.length ? (
        <InlineCarousel media={media} accent={accent} />
      ) : (
        <div className="text-sm text-white italic">No media yet.</div>
      )}

      {/* External link */}
      {project?.href ? (
        <a
          href={project.href}
          target="_blank"
          rel="noreferrer"
          className="
            inline-flex items-center gap-2
            px-4 py-2 rounded-md
            text-black font-semibold
            transition-transform
            hover:-translate-y-px
            active:translate-y-0
            focus-visible:outline-none
          "
          style={{
            backgroundColor: accent,
            boxShadow: `0 0 0 1px ${accentBorder}, 0 10px 30px ${accentGlow}`,
          }}
        >
          Visit project ↗
        </a>
      ) : (
        <div className="text-xs text-white">No external link provided.</div>
      )}

      {/* Long content (HTML string) */}
      {html ? (
        <div
          onClickCapture={onContentClickCapture}
          className={`
            prose prose-invert max-w-none
            prose-headings:text-white
            prose-p:text-white
            prose-strong:text-white
            prose-a:text-white underline decoration-white hover:decoration-white

            whitespace-pre-wrap wrap-break-words
            prose-figure:my-4 prose-figcaption:text-white/70
            [&_br]:block

            [&_img]:cursor-zoom-in
            [&_img]:pointer-events-auto
            [&_img]:select-none
            [&_img]:max-w-full
            [&_img]:h-auto
            [&_img]:block
          `}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="text-white/90 text-sm">More info coming soon.</p>
      )}
    </div>
  );
}
