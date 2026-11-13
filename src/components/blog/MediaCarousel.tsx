"use client";

import React from "react";
import { Carousel } from "react-responsive-carousel";
import "react-responsive-carousel/lib/styles/carousel.min.css";
import BlogContent from "./BlogContent";
import { normalizeGalleryMedia } from "@/lib/blog/gallery";

export type Media = {
  id?: string | number; type: "image" | "youtube" | "instagram"; url: string;
  caption?: string | null; title?: string | null;
};

/** Reuse the same constrained renderer and opt-in behavior as inline embeds. */
export default function MediaCarousel({ media }: { media: Media[] }) {
  const normalized = normalizeGalleryMedia(media);
  if (!normalized.length) return null;
  const multiple = normalized.length > 1;
  return <section className="blog-gallery min-w-0 max-w-full" aria-label="Post media gallery">
    <Carousel showThumbs={false} showStatus={multiple} showIndicators={false}
      showArrows={multiple} autoPlay={false} infiniteLoop={false} useKeyboardArrows={multiple}
      swipeable={multiple} emulateTouch={multiple} transitionTime={200}
      labels={{ leftArrow: "Previous media", rightArrow: "Next media", item: "Media item" }}>
      {normalized.map(item => <div key={item.id} className="min-w-0 p-2">
        <BlogContent content={`[MEDIA ${item.type.toUpperCase()}: media (${item.id})]`} media={[item]} />
      </div>)}
    </Carousel>
  </section>;
}
