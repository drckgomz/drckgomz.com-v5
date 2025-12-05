// frontend/src/features/terminal/hooks/useMedia.ts
"use client";

import * as React from "react";

export function useMedia() {
  const [isAudioPlaying, setIsAudioPlaying] = React.useState(false);
  const [audioSrc, setAudioSrc] = React.useState("");
  const [isHiddenVideoPlaying, setIsHiddenVideoPlaying] = React.useState(false);
  const [hiddenVideoSrc, setHiddenVideoSrc] = React.useState(
    (process.env.NEXT_PUBLIC_S3_MEDIA_BASE ||
      "https://s3.us-east-1.amazonaws.com/www.drckgomz.com") + "/broken.mp4"
  );
  const videoRef = React.useRef<HTMLVideoElement>(null!);

  const stopAllMedia = React.useCallback(() => {
    setIsAudioPlaying(false);
    setAudioSrc("");
    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
        v.currentTime = 0;
      } catch {}
    }
    setIsHiddenVideoPlaying(false);
  }, []);

  // “gated” side-effects
  const playAudioIf = React.useCallback(
    (cond: () => boolean, src: string) => {
      if (!cond()) return;
      stopAllMedia();
      setAudioSrc(src);
      setIsAudioPlaying(true);
    },
    [stopAllMedia]
  );

  const showVideoIf = React.useCallback(
    (cond: () => boolean, src: string) => {
      if (!cond()) return;
      stopAllMedia();
      setHiddenVideoSrc(src);
      setIsHiddenVideoPlaying(true);
    },
    [stopAllMedia]
  );

  return {
    // state
    isAudioPlaying,
    audioSrc,
    isHiddenVideoPlaying,
    hiddenVideoSrc,
    videoRef,

    // actions
    stopAllMedia,
    playAudioIf,
    showVideoIf,
    setIsHiddenVideoPlaying,
  };
}
