// src/components/home/sections/project/TileThumb.tsx
"use client";
import * as React from "react";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function hexToRgba(hex: string, alpha: number) {
  const h = (hex || "").replace("#", "").trim();
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(124, 58, 237, ${alpha})`; // fallback = purple
}

function lightenHex(hex: string, amount = 0.12) {
  const h = (hex || "").replace("#", "").trim();
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);

  const nr = clamp(Math.round(r + (255 - r) * amount), 0, 255);
  const ng = clamp(Math.round(g + (255 - g) * amount), 0, 255);
  const nb = clamp(Math.round(b + (255 - b) * amount), 0, 255);

  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
}

export default function TileThumb({
  label,
  color,
  thumb,
  excerpt,
  active = false,
}: {
  label: string;
  color: string;
  thumb?: string | null;
  excerpt?: string;
  active?: boolean;
}) {
  const baseColor = color || "#7C3AED";
  const hoverColor = lightenHex(baseColor, 0.1);

  const baseShadow = "0 8px 16px rgba(0,0,0,.25)";
  const hoverShadow = "0 18px 35px rgba(0,0,0,.45), 0 4px 10px rgba(0,0,0,.25)";

  const [transform, setTransform] = React.useState<string>(
    "translate3d(0,0,0) rotate(0deg) scale(1)"
  );
  const [shadow, setShadow] = React.useState<string>(baseShadow);
  const [ring, setRing] = React.useState<string>(() => {
    if (!active) return "";
    const glow = hexToRgba(baseColor, 0.35);
    const border = hexToRgba(baseColor, 0.85);
    return `0 0 0 1px ${border}, 0 0 26px ${glow}`;
  });

  const onEnter = () => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      // still do glow even if reduced motion
      const glow = hexToRgba(hoverColor, 0.38);
      const border = hexToRgba(hoverColor, 0.95);
      setRing(`0 0 0 1px ${border}, 0 0 28px ${glow}`);
      setShadow(hoverShadow);
      return;
    }

    const tx = Math.random() * 12 - 6; // -6px .. 6px
    const ty = -(8 + Math.random() * 10); // -8px .. -18px
    const rot = Math.random() * 4 - 2; // -2deg .. 2deg

    setTransform(`translate3d(${tx}px, ${ty}px, 0) rotate(${rot}deg) scale(1.02)`);
    setShadow(hoverShadow);

    const glow = hexToRgba(hoverColor, 0.38);
    const border = hexToRgba(hoverColor, 0.95);
    setRing(`0 0 0 1px ${border}, 0 0 28px ${glow}`);
  };

  const onLeave = () => {
    setTransform("translate3d(0,0,0) rotate(0deg) scale(1)");
    setShadow(baseShadow);

    if (active) {
      const glow = hexToRgba(baseColor, 0.35);
      const border = hexToRgba(baseColor, 0.85);
      setRing(`0 0 0 1px ${border}, 0 0 26px ${glow}`);
    } else {
      setRing("");
    }
  };

  const borderColor = active ? hexToRgba(baseColor, 0.9) : "rgba(255,255,255,.15)";

  return (
    <div
      className="
        w-full aspect-square rounded-2xl overflow-hidden
        transition-transform duration-300 ease-out
        cursor-pointer
      "
      title={label}
      style={{
        transform,
        willChange: "transform, box-shadow",
        border: `1px solid ${borderColor}`,
        boxShadow: ring ? `${shadow}, ${ring}` : shadow,
        ...(thumb ? {} : { background: baseColor }),
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {thumb ? (
        <div className="relative w-full h-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt={label}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              el.src = "/logo192.png";
            }}
          />

          {/* bottom-only dark strip */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-black/55" />

          {/* title + excerpt over strip */}
          <div className="absolute inset-x-0 bottom-0 p-3">
            <div className="text-white font-semibold drop-shadow">{label}</div>
            {excerpt ? (
              <div className="mt-0.5 text-white/90 text-xs leading-snug line-clamp-2">
                {excerpt}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="w-full h-full grid place-items-center p-3 text-center">
          <div className="text-white text-lg sm:text-xl font-semibold">{label}</div>
          {excerpt ? (
            <div className="mt-1 text-white/90 text-xs leading-snug max-w-[90%]">
              {excerpt}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
