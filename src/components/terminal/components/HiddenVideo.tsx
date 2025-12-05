// frontend/src/features/terminal/components/HiddenVideo.tsx

"use client";
import * as React from "react";
import { registerMedia, unregisterMedia, playExclusive } from "@/components/terminal/lib/mediaController";
import "@/components/terminal/components/hidden-video.css";


type Props = {
  videoRef: React.RefObject<HTMLVideoElement>;
  videoSrc: string;
  onClose: () => void;
  id?: string;
};

const forwardSpeeds = [1, 2, 4, 6] as const;
const rewindSpeeds  = [1, 4, 6] as const;

export default function HiddenVideo({ videoRef, videoSrc, onClose, id }: Props) {
  const internalId = React.useId();
  const key = id ?? `hidden-video-${internalId}`;

  const [isPlaying, setIsPlaying]       = React.useState(true);
  const [muted, setMuted]               = React.useState(false);
  const [volume, setVolume]             = React.useState(30);      // 0..100 UI, mapped to 0..1
  const [progress, setProgress]         = React.useState(0);       // 0..100
  const [showControls, setShowControls] = React.useState(false);
  const [showReplay, setShowReplay]     = React.useState(false);
  const [ffIdx, setFfIdx]               = React.useState(0);
  const [rwIdx, setRwIdx]               = React.useState(0);
  const [disableControls, setDisable]   = React.useState(false);
  const [seeking, setSeeking]           = React.useState(false);

  const rewindTimerRef  = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimerRef    = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const timelineRef     = React.useRef<HTMLDivElement | null>(null);

  const debounce = React.useCallback(() => {
    setDisable(true);
    setTimeout(() => setDisable(false), 250);
  }, []);

  // Register media, wire events, and autoplay
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    registerMedia(key, v);
    v.playbackRate = 1;
    v.volume = volume / 100;

    const safeUpdateProgress = () => {
      if (!v.duration || Number.isNaN(v.duration) || v.duration === Infinity) return;
      setProgress((v.currentTime / v.duration) * 100);
    };

    const tryPlay = async () => {
      try {
        playExclusive(key);
        await v.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    };
    tryPlay();

    const onLoaded = () => {
      setShowReplay(false);
      setIsPlaying(!v.paused);
      safeUpdateProgress();
    };
    const onTime = () => {
      if (seeking) return;
      safeUpdateProgress();
      if (rewindTimerRef.current && v.currentTime <= 0.01) {
        clearInterval(rewindTimerRef.current);
        rewindTimerRef.current = null;
        setRwIdx(0);
        v.pause();
        v.currentTime = 0;
        setIsPlaying(false);
      }
    };
    const onEnded = () => {
      v.pause();
      v.playbackRate = 1;
      v.currentTime = v.duration;
      setProgress(100);
      setIsPlaying(false);
      setShowReplay(true);
      setFfIdx(0);
      setRwIdx(0);
    };
    const onPausedByManager = () => setIsPlaying(false);

    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnded);
    v.addEventListener("paused-by-manager", onPausedByManager as EventListener);

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("paused-by-manager", onPausedByManager as EventListener);
      if (rewindTimerRef.current) clearInterval(rewindTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      unregisterMedia(key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef, key, seeking]);

  // Reflect volume slider to element
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume / 100;
  }, [volume, videoRef]);

  // Auto-hide controls + cursor after 4s
  const bumpControls = React.useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 4000);
  }, []);
  React.useEffect(() => {
    // kick it once initially so the user sees controls on open
    bumpControls();
  }, [bumpControls]);

  // Keep CSS variable --p on the timeline element in sync with progress (0..100)
  React.useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.style.setProperty("--p", String(progress));
    }
  }, [progress]);


  const resetSpeed = () => { setFfIdx(0); setRwIdx(0); };

  async function togglePlay(e?: React.MouseEvent) {
    e?.stopPropagation();
    if (disableControls) return;
    const v = videoRef.current; if (!v) return;
    debounce();

    if (rewindTimerRef.current) { clearInterval(rewindTimerRef.current); rewindTimerRef.current = null; }

    try {
      if (v.paused) {
        playExclusive(key);
        v.playbackRate = forwardSpeeds[ffIdx] ?? 1;
        await v.play();
        setIsPlaying(true);
        setShowReplay(false);
      } else {
        v.pause();
        v.playbackRate = 1;
        setIsPlaying(false);
      }
      resetSpeed();
    } catch {}
  }

  function toggleMute(e?: React.MouseEvent) {
    e?.stopPropagation();
    const v = videoRef.current; if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  function fastForward(e?: React.MouseEvent) {
    e?.stopPropagation();
    const v = videoRef.current; if (!v || disableControls || v.paused) return;
    debounce();

    if (rwIdx > 0) {
      const newRw = rwIdx - 1;
      setRwIdx(newRw);
      if (newRw === 0 && rewindTimerRef.current) {
        clearInterval(rewindTimerRef.current);
        rewindTimerRef.current = null;
      }
      return;
    }
    if (rewindTimerRef.current) {
      clearInterval(rewindTimerRef.current);
      rewindTimerRef.current = null;
    }
    const next = (ffIdx + 1) % forwardSpeeds.length;
    setFfIdx(next);
    v.playbackRate = forwardSpeeds[next];
  }

  function rewind(e?: React.MouseEvent) {
    e?.stopPropagation();
    const v = videoRef.current; if (!v || disableControls || v.paused) return;
    debounce();

    if (ffIdx > 0) {
      const newFf = ffIdx - 1;
      setFfIdx(newFf);
      v.playbackRate = forwardSpeeds[newFf];
      return;
    }

    if (rewindTimerRef.current) clearInterval(rewindTimerRef.current);
    const next = (rwIdx + 1) % rewindSpeeds.length;
    setRwIdx(next);

    const skip = rewindSpeeds[next];
    rewindTimerRef.current = setInterval(() => {
      if (!videoRef.current) return;
      if (videoRef.current.currentTime > skip) {
        videoRef.current.currentTime -= skip;
      } else {
        videoRef.current.currentTime = 0;
        if (rewindTimerRef.current) clearInterval(rewindTimerRef.current);
        rewindTimerRef.current = null;
      }
    }, 500);
  }

  async function replay(e?: React.MouseEvent) {
    e?.stopPropagation();
    const v = videoRef.current; if (!v) return;
    try {
      setShowReplay(false);
      setIsPlaying(true);
      resetSpeed();
      if (rewindTimerRef.current) { clearInterval(rewindTimerRef.current); rewindTimerRef.current = null; }
      v.currentTime = 0;
      v.playbackRate = 1;
      playExclusive(key);
      await v.play();
    } catch {}
  }

  function handleClose(e: React.MouseEvent) {
    e.stopPropagation();
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.playbackRate = 1;
    }
    if (rewindTimerRef.current) { clearInterval(rewindTimerRef.current); rewindTimerRef.current = null; }
    onClose();
  }

  // ----------------------------
  // Seek (click/drag timeline)
  // ----------------------------
  const percentToTime = (p: number) => {
    const v = videoRef.current; if (!v || !v.duration) return 0;
    const clamped = Math.max(0, Math.min(100, p));
    return (clamped / 100) * v.duration;
  };

  const clientXToPercent = (clientX: number) => {
    const el = timelineRef.current; if (!el) return progress;
    const rect = el.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(100, ratio * 100));
  };

  const seekToPercent = (p: number) => {
    const v = videoRef.current; if (!v) return;
    v.currentTime = percentToTime(p);
    setProgress(p);
    if (v.currentTime < v.duration) setShowReplay(false);
  };

  const onTimelinePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setSeeking(true);
    bumpControls();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    seekToPercent(clientXToPercent(clientX));
    window.addEventListener("mousemove", onTimelinePointerMove as any);
    window.addEventListener("touchmove", onTimelinePointerMove as any, { passive: false } as any);
    window.addEventListener("mouseup", onTimelinePointerUp as any);
    window.addEventListener("touchend", onTimelinePointerUp as any);
  };

  const onTimelinePointerMove = (e: MouseEvent | TouchEvent) => {
    const clientX = e instanceof TouchEvent ? e.touches[0]?.clientX ?? 0 : (e as MouseEvent).clientX;
    seekToPercent(clientXToPercent(clientX));
  };

  const onTimelinePointerUp = () => {
    setSeeking(false);
    window.removeEventListener("mousemove", onTimelinePointerMove as any);
    window.removeEventListener("touchmove", onTimelinePointerMove as any);
    window.removeEventListener("mouseup", onTimelinePointerUp as any);
    window.removeEventListener("touchend", onTimelinePointerUp as any);
  };

  // Cursor hidden when controls hidden, playing, not seeking, and not showing replay
  const hideCursor = isPlaying && !showControls && !seeking && !showReplay;

  return (
  <div
    className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/75 animate-fadeIn ${hideCursor ? "cursor-none" : ""}`}
    onMouseMove={bumpControls}
    onClick={togglePlay}
  >
    {/* Video box */}
    <div className="relative w-[90vw] h-[80vh] max-w-5xl overflow-hidden rounded-lg">
      <video
        ref={videoRef}
        preload="auto"
        className="w-full h-full rounded-lg"
        disablePictureInPicture
        controls={false}
        controlsList="nodownload noremoteplayback nofullscreen"
        muted={muted}
      >
        <source src={videoSrc} type="video/mp4" />
      </video>

      {/* Close */}
      <button
        onClick={handleClose}
        className="absolute top-2 right-2 text-white bg-red-500 hover:bg-red-700 font-bold py-1 px-3 rounded z-50"
        aria-label="Close video"
      >
        ×
      </button>

      {/* Speed Indicator */}
      {(ffIdx > 0 || rwIdx > 0) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/80 border border-white text-white text-2xl font-mono tracking-widest shadow-[0_0_6px_white] z-40">
          {ffIdx > 0 ? `>> x${forwardSpeeds[ffIdx]}` : `<< x${rewindSpeeds[rwIdx]}`}
        </div>
      )}

      {/* LEFT SIDE: vertical volume + mute (auto-hides) */}
      <div
        className={`absolute left-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-3 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}
        onClick={(e) => e.stopPropagation()}
        onMouseMove={(e) => { e.stopPropagation(); }}
      >
        <button
          onClick={toggleMute}
          className="text-white text-2xl bg-black/40 rounded-full p-2 hover:brightness-125"
          title={muted ? "Unmute" : "Mute"}
          aria-label="Toggle mute"
        >
          {muted ? "🔇" : "🔊"}
        </button>

        <div className="relative h-36 w-6 flex items-center justify-center">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={muted ? 0 : volume}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVolume(v);
              if (muted && v > 0) setMuted(false);
            }}
            className="absolute w-36 origin-center rotate-[-90deg] accent-white
                       [::-webkit-slider-runnable-track]:h-1
                       [::-webkit-slider-thumb]:appearance-none
                       [::-webkit-slider-thumb]:h-4 [::-webkit-slider-thumb]:w-4
                       [::-webkit-slider-thumb]:rounded-full [::-webkit-slider-thumb]:bg-white
                       [::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(0,0,0,0.6)]
                       [::-moz-range-track]:h-1
                       [::-moz-range-thumb]:h-4 [::-moz-range-thumb]:w-4 [::-moz-range-thumb]:rounded-full [::-moz-range-thumb]:bg-white"
            aria-label="Volume"
            aria-orientation="vertical"
          />
        </div>
      </div>

      {/* Button Controls (disappearing, overlay) */}
      <div
        className={`absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={rewind}
          disabled={disableControls}
          className="text-white text-3xl bg-transparent rounded-full p-2 hover:brightness-125 drop-shadow-[0_0_6px_black]"
          aria-label="Rewind"
        >
          ⏴︎⏴︎
        </button>

        <button
          onClick={togglePlay}
          disabled={disableControls}
          className="text-white text-3xl bg-transparent rounded-full p-2 hover:brightness-125 drop-shadow-[0_0_6px_black]"
          aria-label="Play/Pause"
        >
          {isPlaying ? "⏸︎" : "▶"}
        </button>

        <button
          onClick={fastForward}
          disabled={disableControls}
          className="text-white text-3xl bg-transparent rounded-full p-2 hover:brightness-125 drop-shadow-[0_0_6px_black]"
          aria-label="Fast forward"
        >
          ⏵︎⏵︎
        </button>
      </div>

      {/* Replay overlay */}
      {showReplay && (
        <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
          <button
            onClick={replay}
            className="pointer-events-auto text-white text-4xl bg-black/60 p-4 rounded-full hover:scale-110 transition-transform z-40"
            aria-label="Replay"
          >
            ⟳
          </button>
        </div>
      )}
    </div>

    {/* Play bar (below video, centered) */}
    <div
      className={`mt-3 w-[90vw] max-w-5xl px-2 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}
      onClick={(e) => e.stopPropagation()}
      onMouseMove={(e) => { e.stopPropagation(); bumpControls(); }}
    >
      <div
        ref={timelineRef}
        className="relative h-3 cursor-pointer select-none"
        onMouseDown={onTimelinePointerDown}
        onTouchStart={onTimelinePointerDown}
      >
        {/* Accessible, native slider overlay (keyboard + SR). */}
        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={progress}
          onChange={(e) => seekToPercent(Number(e.target.value))}
          aria-label="Seek"
          className="absolute inset-0 opacity-0 z-10"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        />

        {/* Visual track */}
        <div className="hiddenvideo-track rounded-full">
          <div className="hiddenvideo-fill" />
          <div className={`hiddenvideo-thumb ${showControls || seeking ? "opacity-100" : "opacity-0"}`} />
        </div>
      </div>
    </div>

  
  </div>
);
}