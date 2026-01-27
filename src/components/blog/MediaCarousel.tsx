// src/components/blog/MediaCarousel.tsx
"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { Carousel } from "react-responsive-carousel";
import "react-responsive-carousel/lib/styles/carousel.min.css";

import { normalizeMaybeS3Url } from "@/lib/blog/media";

export type Media = {
  id?: string | number;
  type: "image" | "youtube" | "instagram";
  url: string;
  caption?: string | null;
  title?: string | null;
};

// robust YouTube id extractor
function getYouTubeVideoId(url: string): string | undefined {
  const match =
    url.match(
      /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([0-9A-Za-z_-]{11})/
    ) || url.match(/[?&]v=([0-9A-Za-z_-]{11})/);

  return match?.[1];
}

function ensureInstagramScript() {
  if (typeof window === "undefined") return;
  if ((window as any).instgrm?.Embeds) return;

  const existing = document.querySelector<HTMLScriptElement>(
    'script[src^="https://www.instagram.com/embed.js"]'
  );
  if (existing) return;

  const s = document.createElement("script");
  s.async = true;
  s.defer = true;
  s.src = "https://www.instagram.com/embed.js";
  document.body.appendChild(s);
}

function processInstagramEmbeds() {
  if (typeof window === "undefined") return;
  (window as any).instgrm?.Embeds?.process?.();
}

export default function MediaCarousel({ media }: { media: Media[] }) {
  const carouselRef = useRef<any>(null);

  // Normalize urls so "uploads/..." or "/uploads/..." becomes S3 URL in the browser
  const normalized = useMemo(() => {
    const list = Array.isArray(media) ? media : [];
    return list.map((m) => ({
      ...m,
      url: normalizeMaybeS3Url(m.url) ?? m.url,
    }));
  }, [media]);

  useEffect(() => {
    ensureInstagramScript();
    const t = setTimeout(processInstagramEmbeds, 350);
    return () => clearTimeout(t);
  }, [normalized]);

  if (!normalized || normalized.length === 0) return null;

  const hasMultiple = normalized.length > 1;

  return (
    <div className="relative z-0 mt-20 overflow-hidden">
      <Carousel
        ref={carouselRef}
        showThumbs={false}
        showStatus={false}
        showIndicators={hasMultiple}
        showArrows={hasMultiple}
        infiniteLoop={hasMultiple}
        autoPlay={hasMultiple}
        swipeable={hasMultiple}
        emulateTouch={hasMultiple}
        stopOnHover={hasMultiple}
        transitionTime={450}
        className="custom-carousel"
        onChange={() => {
          // Instagram sometimes needs a re-process after slide change
          setTimeout(processInstagramEmbeds, 250);
        }}
      >
        {normalized.map((item, index) => {
          const key = String(item.id ?? index);
          const label = item.caption || item.title || `${item.type} ${index + 1}`;

          if (item.type === "youtube") {
            const vid = getYouTubeVideoId(item.url);
            const embedUrl = vid ? `https://www.youtube.com/embed/${vid}` : item.url;

            return (
              <div key={key} className="flex justify-center bg-black py-8">
                <div className="w-full max-w-[960px]">
                  <div className="relative aspect-video overflow-hidden rounded-xl ring-1 ring-white/10">
                    <iframe
                      src={embedUrl}
                      title={label}
                      frameBorder={0}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 h-full w-full"
                    />
                  </div>
                </div>
              </div>
            );
          }

          if (item.type === "instagram") {
            // For Instagram, give it real width. 120px will almost always fail visually.
            // Instagram embed will size itself; we just provide a centered container.
            return (
              <div key={key} className="flex justify-center bg-black py-8">
                <div className="w-full max-w-[560px]">
                  <div className="rounded-xl bg-black ring-1 ring-white/10 p-1">
                    <blockquote
                      className="instagram-media m-0 w-full border-0 bg-black"
                      data-instgrm-permalink={item.url}
                      data-instgrm-version="14"
                    />
                  </div>
                  {item.caption ? (
                    <p className="mt-2 text-center text-xs text-white/60">{item.caption}</p>
                  ) : null}
                </div>
              </div>
            );
          }

          // image
          return (
            <div key={key} className="flex justify-center bg-black py-8">
              <div className="w-full max-w-[960px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={label}
                  loading="lazy"
                  className="mx-auto max-h-[540px] w-auto max-w-full rounded-xl object-contain ring-1 ring-white/10"
                />
                {item.caption ? (
                  <p className="mt-2 text-center text-xs text-white/60">{item.caption}</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </Carousel>
    </div>
  );
}
