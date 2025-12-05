// frontend/src/features/terminal/components/AudioPlayer.tsx
"use client";
import * as React from "react";
import { registerMedia, unregisterMedia, playExclusive } from "@/components/terminal/lib/mediaController";
import "@/components/terminal/components/audio-player.css";

type InputElRef =
  | React.RefObject<HTMLInputElement>
  | React.MutableRefObject<HTMLInputElement | null>;


type Props = {
  isAudioPlaying: boolean;
  src: string;
  id?: string;
  className?: string;
  defaultVolume?: number;
  terminalInputRef?: InputElRef;
};

export default function AudioPlayer({
  isAudioPlaying,
  src,
  id,
  className = "",
  defaultVolume = 0.4,
  terminalInputRef,                                  // ✅ accept it
}: Props) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const internalId = React.useId();
  const key = id ?? `audio-${internalId}`;

  React.useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    registerMedia(key, el);
    el.volume = defaultVolume;

    const onPausedByManager = () => {};
    el.addEventListener("paused-by-manager", onPausedByManager as EventListener);

    return () => {
      el.removeEventListener("paused-by-manager", onPausedByManager as EventListener);
      unregisterMedia(key);
      el.pause();
      el.currentTime = 0;
    };
  }, [key, defaultVolume]);

  // Parent intent
  React.useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    if (isAudioPlaying && src) {
      playExclusive(key);
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [isAudioPlaying, src, key]);

  // 🔸 Autofocus player when starting playback, unless terminal has focus
  React.useEffect(() => {
    const el = audioRef.current;
    if (!el || !isAudioPlaying || !src) return;
    if (document.activeElement !== (terminalInputRef?.current ?? null)) {
      setTimeout(() => {
        try { el.focus({ preventScroll: true } as any); } catch {}
      }, 0);
    }
  }, [isAudioPlaying, src, terminalInputRef]);

  // 🔸 Space toggles play/pause globally, but ignore when terminal is focused
  React.useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const isSpace = e.code === "Space" || e.key === " " || (e as any).keyCode === 32;
      if (!isSpace || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;

      // Skip if terminal input currently focused
      if (document.activeElement === (terminalInputRef?.current ?? null)) return;

      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      const isEditable = t?.isContentEditable ?? false;
      const isTextInput = !!tag && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(tag);
      if (isTextInput || isEditable) return;

      e.preventDefault();

      if (el.paused) {
        playExclusive(key);
        el.play().catch(() => {});
      } else {
        el.pause();
        // optional hard stop: el.currentTime = 0;
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [key, terminalInputRef]);

  if (!isAudioPlaying || !src) return null;

  return (
    <div className={`relative mt-2 mx-auto max-w-sm z-30 ${className}`}>
      <audio
        ref={audioRef}
        src={src}
        controls
        preload="auto"
        tabIndex={-1}
        className="w-full custom-audio"
        controlsList="noplaybackrate nodownload"
        aria-label="Audio player"
      />
    </div>
  );
}
