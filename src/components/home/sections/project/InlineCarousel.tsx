// frontend/src/features/home/components/project/InlineCarousel.tsx
"use client";
import * as React from "react";

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


export default function InlineCarousel({
  media,
  accent = "#22d3ee",
}: {
  media: any[];
  accent?: string;
}) {
  const [i, setI] = React.useState(0);
  if (!media?.length) return null;

  const cur = media[i];
  const multi = media.length > 1;

  const accentGlow = hexToRgba(accent, 0.35);
  const accentBorder = hexToRgba(accent, 0.9);

  return (
    <div className="w-full">
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
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cur.url}
              alt={cur.caption || ""}
              className="h-full w-full object-contain"
            />
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
              style={{
                border: "1px solid rgba(255,255,255,0.20)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 0 1px ${accentBorder}, 0 0 18px ${accentGlow}`;
                (e.currentTarget as HTMLButtonElement).style.borderColor = accentBorder;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.20)";
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
              style={{
                border: "1px solid rgba(255,255,255,0.20)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 0 1px ${accentBorder}, 0 0 18px ${accentGlow}`;
                (e.currentTarget as HTMLButtonElement).style.borderColor = accentBorder;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.20)";
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
