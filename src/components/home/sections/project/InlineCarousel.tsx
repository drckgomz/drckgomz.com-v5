// frontend/src/features/home/components/project/InlineCarousel.tsx
"use client";
import * as React from "react";

export default function InlineCarousel({ media }: { media: any[] }) {
  const [i, setI] = React.useState(0);
  if (!media?.length) return null;

  const cur = media[i];
  const multi = media.length > 1;

  return (
    <div className="w-full">
      {/* Outer frame */}
      <div className="w-full rounded-lg border border-white/10 bg-black/20 overflow-hidden">
        {/* Size limiter: 16:9 AND max 60vh so it never overwhelms the screen */}
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

      {/* Controls show only if there is more than one item */}
      {multi && (
        <>
          <div className="mt-2 flex items-center justify-between">
            <button
              onClick={() => setI((p) => (p === 0 ? media.length - 1 : p - 1))}
              className="px-3 py-1 rounded ring-1 ring-white/20 hover:bg-white/10 text-sm"
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
              className="px-3 py-1 rounded ring-1 ring-white/20 hover:bg-white/10 text-sm"
            >
              Next →
            </button>
          </div>

          {/* Thumbs */}
          <div className="mt-3 grid grid-cols-6 gap-2">
            {media.map((m, idx) => (
              <button
                key={m.id || idx}
                onClick={() => setI(idx)}
                className={`aspect-video overflow-hidden rounded border ${
                  i === idx ? "border-cyan-400" : "border-white/10"
                } bg-black/20`}
                title={m.caption || ""}
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
            ))}
          </div>
        </>
      )}
    </div>
  );
}
