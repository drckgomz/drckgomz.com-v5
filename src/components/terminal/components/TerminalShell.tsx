// src/components/terminal/components/TerminalShell.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth, useClerk } from "@clerk/nextjs";

import TerminalOutput from "@/components/terminal/components/TerminalOutput";
import TerminalInput from "@/components/terminal/components/TerminalInput";
import AudioPlayer from "@/components/terminal/components/AudioPlayer";
import HiddenVideo from "@/components/terminal/components/HiddenVideo";

import { useTerminalIO } from "@/components/terminal/hooks/useTerminalIO";
import { useMedia } from "@/components/terminal/hooks/useMedia";
import { useCommandEngine } from "@/components/terminal/hooks/useCommandEngine";

export default function TerminalShell() {
  const router = useRouter();
  const { isLoaded, userId, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const [isAdmin] = React.useState(false);

  const { lines, typeWrite, clearTerminal, beginCommandSession, isActive } = useTerminalIO();

  const {
    isAudioPlaying,
    audioSrc,
    isHiddenVideoPlaying,
    hiddenVideoSrc,
    videoRef,
    stopAllMedia,
    playAudioIf,
    showVideoIf,
    setIsHiddenVideoPlaying,
  } = useMedia();

  const { engineRef, isReady } = useCommandEngine({
    print: () => {},
    typeWrite,
    isActive,
    isSignedIn: Boolean(isSignedIn),
    isAdmin,
    playAudioIf,
    showVideoIf,
  });

  const [input, setInput] = React.useState("");
  const [history, setHistory] = React.useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // ✅ focus without iOS scrolling the page
  React.useEffect(() => {
    const t = setTimeout(() => {
      try {
        inputRef.current?.focus?.({ preventScroll: true } as any);
      } catch {
        inputRef.current?.focus?.();
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // ✅ if user taps anywhere in the terminal area, refocus without scroll jump
  const refocus = React.useCallback(() => {
    try {
      inputRef.current?.focus?.({ preventScroll: true } as any);
    } catch {
      inputRef.current?.focus?.();
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw = input.trim();
    if (!raw) return;

    const lower = raw.toLowerCase();
    setInput("");

    try {
      if (lower === "clear" || lower === "cls") {
        stopAllMedia();
        clearTerminal();
        return;
      }

      setHistory((p) => [...p, raw]);
      setHistoryIndex((p) => p + 1);

      await typeWrite("> " + raw);

      if (lower === "blog") {
        await typeWrite("Opening blog…");
        router.push("/blog");
        return;
      }

      if (lower === "logout") {
        await signOut();
        router.push("/terminal");
        return;
      }

      const engine = engineRef.current;
      if (!engine) {
        await typeWrite("Engine not ready. Try again.");
        return;
      }

      beginCommandSession();
      await engine.execute(raw);
    } catch (e) {
      try {
        await typeWrite("Error: " + (e as Error)?.message);
      } catch {}
    }
  }

  return (
    <>
      <main
        className="relative z-10 mx-auto w-full max-w-xl px-4"
        // ✅ tap anywhere in the shell: keep input focused without causing scroll jump
        onPointerDown={(e) => {
          // don't steal focus from buttons/inputs etc.
          const t = e.target as HTMLElement | null;
          const tag = t?.tagName;
          if (tag && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(tag)) return;
          refocus();
        }}
      >
        {/* space between header and terminal */}
        <div className="mt-8 sm:mt-10" />

        <div
          className="mx-auto w-full rounded-lg border border-prompt-color bg-black/55 overflow-hidden flex flex-col"
          style={{
            /**
             * ✅ KEY IDEA:
             * - use svh so the "layout viewport" doesn't jump around on iOS
             * - if you have --kb being set, shrink only THIS box (not the page)
             * - multiply kb by 0.35 so you get "tiny or near-zero" movement
             */
            height: "max(220px, calc(clamp(220px, 34svh, 320px) - (var(--kb, 0px) * 0.35)))",
          }}
        >
          <TerminalOutput lines={lines} />
          <TerminalInput
            input={input}
            setInput={setInput}
            handleSubmit={(e) => void onSubmit(e)}
            inputRef={inputRef}
            history={history}
            historyIndex={historyIndex}
            setHistoryIndex={setHistoryIndex}
            setInputFromHistory={(cmd) => setInput(cmd)}
            onAnyFocus={refocus}
          />
        </div>

        <div className="mt-2">
          <AudioPlayer isAudioPlaying={isAudioPlaying} src={audioSrc} terminalInputRef={inputRef} />
        </div>
      </main>

      {isHiddenVideoPlaying && (
        <HiddenVideo
          key={hiddenVideoSrc}
          videoRef={videoRef}
          videoSrc={hiddenVideoSrc}
          onClose={() => setIsHiddenVideoPlaying(false)}
        />
      )}
    </>
  );
}
