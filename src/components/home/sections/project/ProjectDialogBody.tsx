// frontend/src/features/home/components/project/ProjectDialogBody.tsx
"use client";

import * as React from "react";
import InlineCarousel from "@/components/home/sections/project/InlineCarousel";
import type { Project } from "@/components/home/sections/project/useProjectDetail";

function hexToRgba(input: string, alphaOverride?: number) {
  const raw = (input ?? "").trim();

  // If already rgba/rgb, just pass through (optionally replace alpha)
  if (/^rgba?\(/i.test(raw)) {
    if (alphaOverride == null) return raw;
    // naive replace alpha if rgba(...); if rgb(...), convert to rgba
    const nums = raw.replace(/[^\d.,]/g, "").split(",").map((x) => Number(x.trim()));
    if (nums.length >= 3) {
      const [r, g, b] = nums;
      return `rgba(${r}, ${g}, ${b}, ${alphaOverride})`;
    }
  }

  // Normalize hex: allow "f11e1e" or "#f11e1e"
  let h = raw.startsWith("#") ? raw.slice(1) : raw;
  h = h.trim();

  // Expand #RGBA or #RGB
  if (h.length === 3 || h.length === 4) {
    h = h.split("").map((c) => c + c).join("");
  }

  // Now we support:
  // RRGGBB (6) or RRGGBBAA (8)
  if (h.length !== 6 && h.length !== 8) {
    // fallback cyan-ish
    const a = alphaOverride ?? 1;
    return `rgba(34, 211, 238, ${a})`;
  }

  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);

  // If hex includes AA, use it unless override provided
  let aFromHex = 1;
  if (h.length === 8) {
    aFromHex = parseInt(h.slice(6, 8), 16) / 255;
  }

  const a = alphaOverride ?? aFromHex;

  // Guard NaN
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
    // if it's plain hex without '#', add it
    if (/^[0-9a-f]{3,8}$/i.test(c)) return `#${c}`;
    return c;
  }, [project?.color]);

  const accentGlow = hexToRgba(accent, 0.35);
  const accentBorder = hexToRgba(accent, 0.85);

  return (
    <div className="space-y-5">
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
          className={`
            prose prose-invert max-w-none
            prose-headings:text-white
            prose-p:text-white
            prose-strong:text-white
            prose-a:text-white underline decoration-white hover:decoration-white

            /* preserve literal \n + multiple spaces */
            whitespace-pre-wrap wrap-break-words

            /* figures spacing */
            prose-figure:my-4 prose-figcaption:text-white/70

            /* make <br> behave like a real line break in prose blocks */
            [&_br]:block
          `}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className="text-white/90 text-sm">More info coming soon.</p>
      )}
    </div>
  );
}
