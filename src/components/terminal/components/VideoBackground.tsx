// frontend/src/features/terminal/components/VideoBackground.tsx

"use client";
import * as React from "react";

type Props = { cycleMs?: number };

const BASE =
  process.env.NEXT_PUBLIC_S3_MEDIA_BASE ??
  "https://s3.us-east-1.amazonaws.com/www.drckgomz.com";

const SOURCES = [`${BASE}/dockBackground.webm`, `${BASE}/patio2Background.webm`];
const STATIC_IMG = `${BASE}/terminalBackground.jpeg`;

export default function VideoBackground({ cycleMs = 0 }: Props) {
  // Start in "image" mode to avoid a flash of video before detection finishes.
  const [mode, setMode] = React.useState<"image" | "video">("image");
  const [index, setIndex] = React.useState(0);

  // Decide image vs video once on mount (and re-run if you like on resize).
  React.useEffect(() => {
    const isSmall = typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;
    const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const uaMobile = /Mobi|Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const prefersData =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-data: reduce)").matches;

    // If ANY of these are true, prefer the static image.
    const shouldUseImage = isSmall || touch || uaMobile || prefersData;
    setMode(shouldUseImage ? "image" : "video");

    // Pick next source (A→B→A…) and remember it per-visit
    try {
      const last = Number(localStorage.getItem("bgVideoIndex") ?? "-1");
      const next = Number.isFinite(last) ? (last + 1) % SOURCES.length : 0;
      setIndex(next);
      localStorage.setItem("bgVideoIndex", String(next));
    } catch {
      setIndex(0);
    }
  }, []);

  // Optional in-page rotation (disabled on image mode)
  React.useEffect(() => {
    if (mode === "image" || cycleMs <= 0) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % SOURCES.length), cycleMs);
    return () => clearInterval(t);
  }, [mode, cycleMs]);

  const selected = SOURCES[index];
  const selectedMp4 = selected.replace(".webm", ".mp4");

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
      {mode === "image" ? (
        <img src={STATIC_IMG} alt="Background" className="w-full h-full object-cover" />
      ) : (
        <video
          key={selected}
          playsInline
          autoPlay
          muted
          loop
          preload="auto"
          className="w-full h-full object-cover"
          disablePictureInPicture
          controlsList="nodownload nofullscreen noremoteplayback"
        >
          <source src={selected} type="video/webm" />
          <source src={selectedMp4} type="video/mp4" />
        </video>
      )}
    </div>
  );
}