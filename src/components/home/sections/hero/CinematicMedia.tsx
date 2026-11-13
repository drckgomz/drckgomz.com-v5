"use client";

import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import { isSafeLocalMediaPath } from "./localMedia";

type Props = {
  sources?: readonly string[];
  poster?: string;
  objectPosition?: string;
  className?: string;
};

/** Decorative, inaccessible-to-pointer background film with poster/CSS fallbacks. */
export default function CinematicMedia({
  sources = [], poster, objectPosition = "50% 50%", className = "",
}: Props) {
  const reducedMotion = useReducedMotion();
  const [videoFailed, setVideoFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const safeSources = sources.filter(isSafeLocalMediaPath);
  const playVideo = reducedMotion === false && safeSources.length > 0 && !videoFailed;
  const mediaStyle = { objectPosition } as const;

  return (
    <div className={`cinematic-media ${className}`} aria-hidden="true" inert>
      <div className="cinematic-media__fallback" />
      {poster && !posterFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="cinematic-media__poster"
          src={poster}
          alt=""
          fetchPriority="high"
          decoding="async"
          style={mediaStyle}
          onError={() => setPosterFailed(true)}
        />
      ) : null}
      {playVideo ? (
        <video
          className="cinematic-media__video"
          muted
          playsInline
          loop
          autoPlay
          preload="none"
          poster={poster}
          style={mediaStyle}
          onCanPlay={(event) => event.currentTarget.classList.add("is-ready")}
          onError={() => setVideoFailed(true)}
        >
          {safeSources.map((source) => <source key={source} src={source} />)}
        </video>
      ) : null}
    </div>
  );
}
