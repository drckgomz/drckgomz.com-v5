// src/components/terminal/TerminalShell.tsx
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

const log = (...args: any[]) => console.info("[TERMINAL]", ...args);
const warn = (...args: any[]) => console.warn("[TERMINAL]", ...args);
const err = (...args: any[]) => console.error("[TERMINAL]", ...args);
const group = (label: string) => console.groupCollapsed(`[TERMINAL] ${label}`);
const groupEnd = () => console.groupEnd();

export default function TerminalShell() {
  const router = useRouter();

  const { isLoaded, userId, isSignedIn, sessionId } = useAuth();
  const { signOut } = useClerk();
  const [isAdmin] = React.useState(false);

  const {
    lines,
    print,
    typeWrite,
    clearTerminal,
    beginCommandSession,
    isActive,
  } = useTerminalIO();

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
    print,
    typeWrite,
    isActive,
    isSignedIn: Boolean(isSignedIn),
    isAdmin,
    playAudioIf,
    showVideoIf,
  });

  // DEBUG snapshot
  React.useEffect(() => {
    group("shell:mount");
    log("auth snapshot", { isLoaded, isSignedIn, userId, sessionId });
    log("media snapshot", {
      isAudioPlaying,
      audioSrc,
      isHiddenVideoPlaying,
      hiddenVideoSrc,
    });
    log("engine snapshot", { isReady, hasEngine: !!engineRef.current });
    groupEnd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(
    () => log("auth change", { isLoaded, isSignedIn, userId, sessionId }),
    [isLoaded, isSignedIn, userId, sessionId]
  );
  React.useEffect(
    () => log("engine change", { isReady, hasEngine: !!engineRef.current }),
    [isReady]
  );

  const [input, setInput] = React.useState("");
  const [history, setHistory] = React.useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // ---------- COMMAND SUBMIT ----------
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw = input.trim();
    if (!raw) return;

    const lower = raw.toLowerCase();
    setInput("");

    group(`command "${raw}"`);
    log("before", {
      lower,
      isLoaded,
      isSignedIn,
      userId,
      sessionId,
      isActive: isActive(),
      isReady,
      hasEngine: !!engineRef.current,
    });
    console.time("[TERMINAL] command duration");

    try {
      if (lower === "clear" || lower === "cls") {
        stopAllMedia();
        clearTerminal();
        log("action", "clear");
        return;
      }

      setHistory((p) => [...p, raw]);
      setHistoryIndex((p) => p + 1);

      await typeWrite("> " + raw);

      if (["help", "h", "-h"].includes(lower)) {
        if (!isReady) {
          warn("help invoked before engine ready — waiting briefly");
          for (let i = 0; i < 30 && !engineRef.current; i++) {
            await new Promise((r) => setTimeout(r, 50));
          }
        }

        const eng = engineRef.current;
        if (!eng) {
          err("help: engineRef.current is null after wait");
        }

        const all = eng?.list?.() ?? [];
        log("help: list() raw size", all.length, all);

        const normalized = all.map((c: any) => ({
          ...c,
          enabled: c.enabled !== false,
          showInHelp: c.showInHelp !== false,
          name: String(c.name || ""),
          description: String(c.description || ""),
        }));

        const visible = normalized
          .filter((c) => c.enabled && c.showInHelp)
          .sort((a, b) => a.name.localeCompare(b.name));

        try {
          console.table(
            normalized.map((c: any) => ({
              name: c.name,
              enabled: c.enabled,
              showInHelp: c.showInHelp,
              desc: c.description,
            }))
          );
        } catch {}

        await typeWrite("Commands:\n");

        for (const c of visible) {
          const desc = c.description ? ` — ${c.description}` : "";
          await typeWrite(`  ${c.name}${desc}\n`, 18);
        }

        const names = new Set(visible.map((c) => c.name.toLowerCase()));
        if (!names.has("blog"))
          await typeWrite("  blog — open blog (sign-in required)\n", 18);
        if (!names.has("logout"))
          await typeWrite("  logout — sign out\n", 18);
        if (!names.has("clear"))
          await typeWrite("  clear — clear terminal\n", 18);

        if (!visible.length) {
          await typeWrite(
            "  (no commands available yet — still loading or fetch returned empty)\n",
            18
          );
        }

        log("action", "help", {
          registered: all.length,
          visible: visible.length,
          names: visible.map((c) => c.name),
        });
        return;
      }

      if (lower === "blog") {
        await typeWrite("Opening blog…");
        if (isLoaded && userId) {
          router.push("/blog");
        } else {
          router.push("/blog");
        }
        return;
      }

      if (lower === "logout") {
        log("logout called");
        await signOut();
        router.push("/terminal");
        return;
      }

      const engine = engineRef.current;
      if (!engine) {
        await typeWrite("Engine not ready. Try again.");
        warn("engine not ready at execute", {
          isReady,
          engine: !!engineRef.current,
        });
        return;
      }

      beginCommandSession();
      log("engine.execute start", { cmd: raw });
      await engine.execute(raw);
      log("engine.execute done", { cmd: raw });
    } catch (e) {
      err("command error", e);
      try {
        await typeWrite("Error: " + (e as Error)?.message);
      } catch {}
    } finally {
      console.timeEnd("[TERMINAL] command duration");
      groupEnd();
    }
  }

  return (
    <>
      <main className="relative z-10 mx-auto w-full max-w-4xl flex-1 px-4 pt-24 overflow-y-auto overscroll-contain">
        <div className="bg-black/50 border border-prompt-color rounded-lg min-h-[30vh] overflow-hidden">
          <TerminalOutput lines={lines} />
          <TerminalInput
            input={input}
            setInput={setInput}
            handleSubmit={(e) => {
              void onSubmit(e);
            }}
            inputRef={inputRef}
            history={history}
            historyIndex={historyIndex}
            setHistoryIndex={setHistoryIndex}
            setInputFromHistory={(cmd) => setInput(cmd)}
          />
        </div>

        <div className="mt-2">
          <AudioPlayer
            isAudioPlaying={isAudioPlaying}
            src={audioSrc}
            terminalInputRef={inputRef}
          />
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
