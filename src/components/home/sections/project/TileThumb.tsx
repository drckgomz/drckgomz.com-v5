// src/components/home/sections/project/TileThumb.tsx
"use client";
import * as React from "react";

export default function TileThumb({
  label,
  color,
  thumb,
  excerpt,
}: {
  label: string;
  color: string;
  thumb?: string | null;
  excerpt?: string;
}) {
  const [transform, setTransform] = React.useState<string>(
    "translate3d(0,0,0) rotate(0deg) scale(1)"
  );
  const [shadow, setShadow] = React.useState<string>(
    "0 8px 16px rgba(0,0,0,.25)"
  );

  const onEnter = () => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const tx = Math.random() * 12 - 6; // -6px .. 6px
    const ty = -(8 + Math.random() * 10); // -8px .. -18px
    const rot = Math.random() * 4 - 2; // -2deg .. 2deg

    setTransform(
      `translate3d(${tx}px, ${ty}px, 0) rotate(${rot}deg) scale(1.02)`
    );
    setShadow("0 18px 35px rgba(0,0,0,.45), 0 4px 10px rgba(0,0,0,.25)");
  };

  const onLeave = () => {
    setTransform("translate3d(0,0,0) rotate(0deg) scale(1)");
    setShadow("0 8px 16px rgba(0,0,0,.25)");
  };

  return (
    <div
      className="
        w-full aspect-square rounded-2xl border border-white/15 overflow-hidden
        transition-transform duration-300 ease-out
        cursor-pointer
      "
      title={label}
      style={{
        transform,
        boxShadow: shadow,
        willChange: "transform, box-shadow",
        ...(thumb ? {} : { background: color }),
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
            el.src = "public/logo192.png";
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
