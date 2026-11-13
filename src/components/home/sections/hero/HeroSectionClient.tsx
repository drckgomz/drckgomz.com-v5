"use client";

import CinematicMedia from "./CinematicMedia";

type HeroProps = {
  hero: {
    title?: string;
    thumbnail_url?: string;
    video_sources?: readonly string[];
    object_position?: string;
    overlay?: number;
  };
};

export default function HeroSectionClient({ hero }: HeroProps) {
  const overlay = Math.max(0, Math.min(0.85, Number(hero.overlay ?? 0.32)));
  return (
    <section
      id="hero"
      className="cinematic-hero"
      aria-labelledby="cinematic-title"
      style={{ "--cinematic-overlay-strength": overlay } as React.CSSProperties}
    >
      <CinematicMedia
        poster={hero.thumbnail_url}
        sources={hero.video_sources}
        objectPosition={hero.object_position}
      />
      <div className="cinematic-hero__scrim" aria-hidden="true" />
      <h1 id="cinematic-title" className="sr-only">{hero.title || "drckgomz"}</h1>
    </section>
  );
}
