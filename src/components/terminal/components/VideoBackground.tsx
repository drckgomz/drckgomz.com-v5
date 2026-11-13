// frontend/src/features/terminal/components/VideoBackground.tsx

"use client";
"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";

type Props = { sources?: readonly string[]; poster?: string; objectPosition?: string };

function subscribeMotionPreference(callback: () => void) {
  window.addEventListener("resize", callback);
  const queries = ["(prefers-reduced-motion: reduce)", "(prefers-reduced-data: reduce)"].map((query) => window.matchMedia(query));
  for (const query of queries) query.addEventListener("change", callback);
  return () => {
    window.removeEventListener("resize", callback);
    for (const query of queries) query.removeEventListener("change", callback);
  };
}

function getMotionEnvironmentSnapshot() {
  return window.innerWidth > 768 &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    !window.matchMedia("(prefers-reduced-data: reduce)").matches;
}

function safeBackgroundUrl(value: string): boolean {
  if (!value || value.length > 2048 || /[\u0000-\u0020\\]/.test(value) || value.startsWith("//")) return false;
  if (value.startsWith("/") && !value.startsWith("///")) return !value.split("/").some((part) => part === ".." || part === ".");
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch { return false; }
}

export default function VideoBackground({ sources = [], poster, objectPosition = "50% 50%" }: Props) {
  const reducedMotion = useReducedMotion();
  const wideMotionEnvironment = React.useSyncExternalStore(subscribeMotionPreference, getMotionEnvironmentSnapshot, () => false);
  const [failed, setFailed] = React.useState(false);
  const safeSources = sources.filter(safeBackgroundUrl);
  const safePoster = poster && safeBackgroundUrl(poster) ? poster : undefined;

  const motionAllowed = reducedMotion === false && wideMotionEnvironment;

  return (
    <div className="terminal-background" aria-hidden="true" inert>
      <div className="terminal-background__fallback" />
      {safePoster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="terminal-background__poster" src={safePoster} alt="" style={{ objectPosition }} />
      ) : null}
      {motionAllowed && !failed && safeSources.length > 0 ? (
        <video className="terminal-background__video" muted playsInline autoPlay loop preload="none"
          poster={safePoster} style={{ objectPosition }} onError={() => setFailed(true)}>
          {safeSources.map((src) => <source key={src} src={src} />)}
        </video>
      ) : null}
      <div className="terminal-background__overlay" />
    </div>
  );
}
