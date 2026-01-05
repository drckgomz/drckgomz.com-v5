// src/components/blog/MediaCarousel.tsx
"use client";

import React, { useEffect, useRef } from "react";
import { Carousel } from "react-responsive-carousel";
import "react-responsive-carousel/lib/styles/carousel.min.css";

// ✅ export this so BlogView can import it
export type Media = {
  id?: string | number;
  type: "image" | "youtube" | "instagram";
  url: string;
  caption?: string | null;
  title?: string | null; // ✅ add this OR remove it from BlogView mapping
};

// robust YouTube id extractor
function getYouTubeVideoId(url: string): string | undefined {
  const match =
    url.match(
      /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([0-9A-Za-z_-]{11})/
    ) || url.match(/[?&]v=([0-9A-Za-z_-]{11})/);

  return match?.[1];
}

export default function MediaCarousel({ media }: { media: Media[] }) {
  const carouselRef = useRef<any>(null);

  useEffect(() => {
    const ensureInstaScript = () => {
      if (typeof window === "undefined") return;
      if ((window as any).instgrm?.Embeds) return;

      const existing = document.querySelector<HTMLScriptElement>(
        'script[src^="https://www.instagram.com/embed.js"]'
      );
      if (existing) return;

      const s = document.createElement("script");
      s.async = true;
      s.src = "https://www.instagram.com/embed.js";
      document.body.appendChild(s);
    };

    ensureInstaScript();

    const process = () => {
      (window as any).instgrm?.Embeds?.process?.();
    };

    const t = setTimeout(process, 400);
    return () => clearTimeout(t);
  }, [media]);

  if (!media || media.length === 0) return null;

  const hasMultiple = media.length > 1;

  return (
    <div className="relative z-0 mt-20 overflow-hidden">
      <Carousel
        ref={carouselRef}
        showThumbs={false}
        autoPlay={hasMultiple}
        infiniteLoop={hasMultiple}
        showStatus={false}
        showIndicators={hasMultiple}
        showArrows={hasMultiple}
        swipeable={hasMultiple}
        emulateTouch={hasMultiple}
        transitionTime={1000}
        stopOnHover={hasMultiple}
        className="custom-carousel"
        onChange={() => {
          setTimeout(() => (window as any).instgrm?.Embeds?.process?.(), 400);
        }}
      >
        {media.map((item, index) => {
          const key = String(item.id ?? index);

          return (
            <div key={key} className="flex justify-center items-center bg-black py-8">
              {item.type === "image" ? (
                <img
                  src={item.url}
                  alt={item.caption || `Image ${index + 1}`}
                  className="rounded-lg object-contain max-w-[960px] max-h-[540px]"
                />
              ) : item.type === "youtube" ? (
                <iframe
                  width="818"
                  height="460"
                  src={
                    getYouTubeVideoId(item.url)
                      ? `https://www.youtube.com/embed/${getYouTubeVideoId(item.url)}`
                      : item.url
                  }
                  title={item.caption || `YouTube Video ${index + 1}`}
                  frameBorder={0}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="rounded-lg"
                />
              ) : item.type === "instagram" ? (
                <div className="flex justify-center items-center bg-black w-[120px] h-[460px]">
                  <blockquote
                    className="instagram-media w-full h-full bg-black border-0 rounded-lg m-0 p-0"
                    data-instgrm-permalink={item.url}
                    data-instgrm-version="14"
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </Carousel>
    </div>
  );
}
