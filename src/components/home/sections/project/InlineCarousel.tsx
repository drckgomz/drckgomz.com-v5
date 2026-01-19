// frontend/src/features/home/components/project/InlineCarousel.tsx
"use client";

import * as React from "react";
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

  if (h.length === 3 || h.length === 4) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }

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

export default function InlineCarousel({
  media,
  accent = "#22d3ee",
}: {
  media: any[];
  accent?: string;
}) {
  const [i, setI] = React.useState(0);
  const [openPreview, setOpenPreview] = React.useState(false);

  if (!media?.length) return null;

  const cur = media[i];
  const multi = media.length > 1;

  const accentGlow = hexToRgba(accent, 0.35);
  const accentBorder = hexToRgba(accent, 0.9);

  const isImage = cur?.type === "image" && !!cur?.url;

  return (
    <div className="w-full">
            {/* Lightbox / fullscreen preview */}
      <Dialog open={openPreview} onOpenChange={setOpenPreview}>
        <DialogContent
          className="
            w-screen h-screen max-w-none
            p-0
            border-0
            bg-black/90
            overflow-hidden
            rounded-none
          "
        >
          {/* Accessible title (hidden) */}
          <DialogTitle className="sr-only">
            {cur?.caption ? `Image preview: ${cur.caption}` : "Image preview"}
          </DialogTitle>

          {/* Content */}
          <div className="relative flex h-full w-full items-center justify-center">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cur.url}
                alt={cur.caption || ""}
                draggable={false}
                className="
                  max-h-full max-w-full
                  object-contain
                  select-none
                "
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-white/80 text-sm p-4">
                Preview only available for images.
              </div>
            )}

            {/* optional caption */}
            {cur?.caption ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
                <div className="mx-auto w-fit max-w-[95%] rounded-md bg-black/55 px-3 py-1 text-xs text-white/90 ring-1 ring-white/10">
                  {cur.caption}
                </div>
              </div>
            ) : null}
          </div>


        </DialogContent>
      </Dialog>


      {/* Outer frame */}
      <div
        className="w-full rounded-lg border bg-black/20 overflow-hidden"
        style={{
          borderColor: "rgba(255,255,255,0.10)",
          boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 18px 40px rgba(0,0,0,0.35)`,
        }}
      >
        <div className="mx-auto aspect-video max-h-[60vh] w-full">
          {cur.type === "image" ? (
            <button
              type="button"
              onClick={() => setOpenPreview(true)}
              className="group relative h-full w-full"
              aria-label="Open image preview"
              title="Click to enlarge"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cur.url}
                alt={cur.caption || ""}
                className="h-full w-full object-contain"
              />

              {/* subtle hover affordance */}
              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="absolute inset-0 bg-black/10" />
                <div className="absolute right-3 top-3 rounded-md bg-black/45 px-2 py-1 text-[11px] text-white/90 ring-1 ring-white/10">
                  Click to enlarge
                </div>
              </div>
            </button>
          ) : cur.type === "youtube" ? (
            <iframe
              className="h-full w-full"
              src={cur.url.includes("embed") ? cur.url : cur.url.replace("watch?v=", "embed/")}
              title={cur.caption || "YouTube"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-white/80 text-sm p-4">
              Unsupported media type: {cur.type}
            </div>
          )}
        </div>
      </div>

      {multi && (
        <>
          <div className="mt-2 flex items-center justify-between">
            <button
              onClick={() => setI((p) => (p === 0 ? media.length - 1 : p - 1))}
              className="px-3 py-1 rounded text-sm transition"
              style={{ border: "1px solid rgba(255,255,255,0.20)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 0 1px ${accentBorder}, 0 0 18px ${accentGlow}`;
                (e.currentTarget as HTMLButtonElement).style.borderColor = accentBorder;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "rgba(255,255,255,0.20)";
              }}
            >
              ← Prev
            </button>

            <div className="text-xs text-white/80">
              {i + 1} / {media.length}
              {cur.caption ? (
                <>
                  {" "}
                  • <span className="text-white/70">{cur.caption}</span>
                </>
              ) : null}
            </div>

            <button
              onClick={() => setI((p) => (p === media.length - 1 ? 0 : p + 1))}
              className="px-3 py-1 rounded text-sm transition"
              style={{ border: "1px solid rgba(255,255,255,0.20)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 0 1px ${accentBorder}, 0 0 18px ${accentGlow}`;
                (e.currentTarget as HTMLButtonElement).style.borderColor = accentBorder;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "rgba(255,255,255,0.20)";
              }}
            >
              Next →
            </button>
          </div>

          {/* Thumbs */}
          <div className="mt-3 grid grid-cols-6 gap-2">
            {media.map((m, idx) => {
              const selected = i === idx;

              return (
                <button
                  key={m.id || idx}
                  onClick={() => setI(idx)}
                  className="aspect-video overflow-hidden rounded bg-black/20 transition"
                  title={m.caption || ""}
                  style={{
                    border: `1px solid ${
                      selected ? accentBorder : "rgba(255,255,255,0.10)"
                    }`,
                    boxShadow: selected
                      ? `0 0 0 1px ${accentBorder}, 0 0 20px ${accentGlow}`
                      : undefined,
                  }}
                >
                  {m.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-[10px] text-white/80">
                      {m.type}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
