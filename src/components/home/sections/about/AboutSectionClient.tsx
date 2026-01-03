// src/components/home/sections/about/AboutSectionClient.tsx
"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Media = {
  id: string;
  type: string;
  caption?: string | null;
  original: string;
  w800?: string;
  w1600?: string;
};

type Section = { title?: string | null; description?: string | null };

const NAV_SAFE_TOP = "var(--nav-h, 64px)";

interface AboutSectionClientProps {
  section: Section;
  media: Media[];
}

export default function AboutSectionClient({
  section,
  media,
}: AboutSectionClientProps) {
  const [idx, setIdx] = useState(0);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  const hasMany = media.length > 1;

  const current = useMemo(
    () => (media.length ? media[Math.min(idx, media.length - 1)] : null),
    [media, idx]
  );

  // Guard index if media changes for some reason
  useEffect(() => {
    if (idx >= media.length && media.length > 0) {
      setIdx(0);
    }
  }, [idx, media.length]);

  useEffect(() => {
  // Preload all variants (original + w800 + w1600) once on mount
  media.forEach((m) => {
    [m.original, m.w800, m.w1600]
      .filter(Boolean)
      .forEach((src) => {
        const img = new Image();
        img.src = src as string;
      });
  });
}, [media]);


  const primarySrc =
    current?.w1600 || current?.original || "/logo192.png";
  const primarySrcSet =
    current?.w800 && current?.w1600
      ? `${current.w800} 800w, ${current.w1600} 1600w`
      : undefined;
  const fallbackOriginal = current?.original || "/logo192.png";

  const next = useCallback(
    () => setIdx((i) => (i + 1) % Math.max(1, media.length)),
    [media.length]
  );
  const prev = useCallback(
    () => setIdx((i) => (i - 1 + Math.max(1, media.length)) % Math.max(1, media.length)),
    [media.length]
  );

  // Lightbox helpers
  const openLightbox = (startIdx: number) => {
    setLightboxIdx(startIdx);
    setLightboxOpen(true);
  };
  const closeLightbox = () => setLightboxOpen(false);
  const lbNext = useCallback(
    () => setLightboxIdx((i) => (i + 1) % Math.max(1, media.length)),
    [media.length]
  );
  const lbPrev = useCallback(
    () => setLightboxIdx((i) => (i - 1 + Math.max(1, media.length)) % Math.max(1, media.length)),
    [media.length]
  );

  const lbMedia = media[lightboxIdx];
  const lbPrimarySrc =
    lbMedia?.w1600 || lbMedia?.original || "/logo192.png";
  const lbSrcSet =
    lbMedia?.w800 && lbMedia?.w1600
      ? `${lbMedia.w800} 800w, ${lbMedia.w1600} 1600w`
      : undefined;
  const lbFallbackOriginal = lbMedia?.original || "/logo192.png";

  // Keyboard navigation while lightbox open
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") lbNext();
      if (e.key === "ArrowLeft") lbPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, lbNext, lbPrev]);

  return (
    <>
      <motion.section
        id="about"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        viewport={{ once: true }}
        className="w-full min-h-screen flex flex-col items-center justify-center px-6 text-white"
      >
        <Card className="max-w-5xl w-full bg-transparent border-0 shadow-xl">
          <CardContent className="py-10 px-6 sm:px-10 flex flex-col gap-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <h2 className="text-3xl sm:text-5xl text-white font-bold bg-black/70 text-shadow-lg">
                {section.title || "About Me"}
              </h2>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-8 w-full">
              {/* Carousel (click to open lightbox) */}
              <div className="w-full sm:w-auto flex flex-col items-center">
                <div className="relative w-[18rem] h-72 sm:w-[20rem] sm:h-80 rounded-xl overflow-hidden bg-white/5 border border-white/10 shadow-lg">
                  {current ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={primarySrc}
                      srcSet={primarySrcSet}
                      sizes="(max-width: 640px) 320px, 20rem"
                      alt={current.caption || "About image"}
                      className="w-full h-full object-cover cursor-zoom-in"
                      loading="lazy"
                      decoding="async"
                      onClick={() => openLightbox(idx)}
                      onError={(e) => {
                        const el = e.currentTarget as HTMLImageElement;
                        el.src = fallbackOriginal;
                        el.srcset = "";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-sm text-white/60">
                      No image
                    </div>
                  )}

                  {hasMany && (
                    <>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label="Previous"
                        onClick={prev}
                        className="absolute left-2 top-1/2 -translate-y-1/2 text-white bg-black/40 border-white/40 hover:bg-black/70 hover:text-white"
                      >
                        ←
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label="Next"
                        onClick={next}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white bg-black/40 border-white/40 hover:bg-black/70 hover:text-white"
                      >
                        →
                      </Button>
                    </>
                  )}
                </div>

                {/* Dots */}
                {hasMany && (
                  <div className="mt-3 flex justify-center gap-2">
                    {media.map((m, i) => (
                      <button
                        key={m.id}
                        aria-label={`Go to slide ${i + 1}`}
                        onClick={() => setIdx(i)}
                        className={`w-2.5 h-2.5 rounded-full transition ${
                          i === idx ? "bg-white" : "bg-white/40 hover:bg-white/70"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Text */}
              <p className="text-base sm:text-lg bg-black/70 text-white/90 whitespace-pre-wrap text-left max-w-2xl text-shadow-lg">
                {section.description || "No about content yet."}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.section>

      {/* ----- LIGHTBOX OVERLAY (keeps navbar clickable) ----- */}
      <AnimatePresence>
        {lightboxOpen && lbMedia && (
          <motion.div
            key="about-lightbox"
            className="fixed inset-0 z-9999"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop only below the navbar height */}
            <div
              className="absolute left-0 right-0 bottom-0 bg-black/80 backdrop-blur-sm"
              style={{ top: NAV_SAFE_TOP }}
              onClick={closeLightbox}
            />

            {/* Content area lives below the navbar */}
            <div
              className="absolute left-0 right-0 bottom-0 flex items-center justify-center p-4"
              style={{ top: NAV_SAFE_TOP }}
              onClick={closeLightbox}
            >
              <div
                className="relative bg-black/40 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                style={{
                  maxWidth: "90vw",
                  maxHeight: "80vh",
                  width: "min(1200px, 90vw)",
                  height: "min(80vh, 900px)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <AnimatePresence mode="wait">
                  <motion.img
                    key={`${lbMedia.id}-${lbPrimarySrc}`}
                    // eslint-disable-next-line @next/next/no-img-element
                    src={lbPrimarySrc}
                    srcSet={lbSrcSet}
                    sizes="100vw"
                    alt={lbMedia.caption || "About image"}
                    className="w-full h-full object-contain select-none"
                    initial={{ opacity: 0, scale: 0.985 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.985 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    onError={(e) => {
                      const el = e.currentTarget as HTMLImageElement;
                      el.src = lbFallbackOriginal;
                      el.srcset = "";
                    }}
                    draggable={false}
                  />
                </AnimatePresence>

                {/* Close button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Close"
                  onClick={closeLightbox}
                  className="absolute top-3 right-3 bg-black/40 border-white/40 hover:bg-black/70"
                >
                  ✕
                </Button>

                {/* Prev / Next (if multiple) */}
                {media.length > 1 && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Previous image"
                      onClick={lbPrev}
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 border-white/40 hover:bg-black/70"
                    >
                      ←
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Next image"
                      onClick={lbNext}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 border-white/40 hover:bg-black/70"
                    >
                      →
                    </Button>
                  </>
                )}

                {/* Caption bar */}
                {lbMedia.caption && lbMedia.caption.trim() && (
                  <div className="absolute left-0 right-0 bottom-0 text-center">
                    <div className="pointer-events-none mx-auto max-w-5xl px-4 py-3 text-sm text-white">
                      <div className="bg-linear-to-t from-black/70 to-transparent -mb-3 pb-3 pt-8 px-4 rounded-t-xl">
                        <span className="block">{lbMedia.caption}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
