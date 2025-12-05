// frontend/src/features/terminal/hooks/useCommandEngine.ts
"use client";

import * as React from "react";
import { CommandEngine } from "@/components/terminal/lib/engine";
import { useRouter } from "next/navigation";

type UseCommandEngineArgs = {
  print: (t: string) => void;
  typeWrite: (t: string, speed?: number, newlineAfter?: boolean) => Promise<void>;
  isActive: () => boolean;
  isSignedIn: boolean;
  isAdmin: boolean;
  playAudioIf: (cond: () => boolean, src: string) => void;
  showVideoIf: (cond: () => boolean, src: string) => void;
};

// DEBUG helpers
const info  = (...a: any[]) => console.info("[TERMINAL]", ...a);
const warn  = (...a: any[]) => console.warn("[TERMINAL]", ...a);
const error = (...a: any[]) => console.error("[TERMINAL]", ...a);

// robust boolean normalizer so "false", 0, undefined are handled correctly
const toBool = (v: any, defaultIfUndef = true) => {
  if (v === undefined || v === null) return defaultIfUndef;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return !/^(false|0)$/i.test(v.trim());
  return defaultIfUndef;
};

export function useCommandEngine({
  print,
  typeWrite,
  isActive,
  isSignedIn,
  isAdmin,
  playAudioIf,
  showVideoIf,
}: UseCommandEngineArgs) {
  const router = useRouter();
  const engineRef = React.useRef<CommandEngine | null>(null);
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    async function loadAndBuild() {
      const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
      const url = base ? `${base}/v1/public/terminal/commands` : "/api/terminal/commands";

      try {
        info("fetch:start", { url });
        console.time("[TERMINAL] fetch+build");

        const res = await fetch(url, { cache: "no-store" });
        info("fetch:response", { status: res.status });

        if (!res.ok) {
          await typeWrite("Failed to load commands from database.");
          return;
        }

        const payload = await res.json();

        // CHANGED: accept both array and { items: [...] } shapes
        // If payload is { items: [...] }, prefer that; otherwise, if it's already an array, use it.
        // Anything else -> empty array.
        const rows: any[] = Array.isArray(payload)
          ? payload
          : (payload && Array.isArray(payload.items) ? payload.items : []);

        info("fetch:rows", {
          type: Array.isArray(payload) ? "array" : typeof payload,
          count: rows.length,                         // CHANGED: accurate count after unwrapping .items
          sample: rows.slice(0, 3),
        });

        // If we already have a non-empty registry and this fetch returns empty, keep prior registry
        if (engineRef.current && engineRef.current.list().length > 1 && rows.length === 0) {
          warn("fetch returned empty; keeping existing registry");
          console.timeEnd("[TERMINAL] fetch+build");
          return;
        }

        const eng = new CommandEngine({
          print,
          typeWrite,
          navigate: (href) => { if (!isActive()) return; router.push(href); },
          openUrl: (u, newTab) => { if (!isActive()) return; window.open(u, newTab ? "_blank" : "_self", "noopener"); },
          playAudio: (src) => playAudioIf(isActive, src),
          showVideo: (src) => showVideoIf(isActive, src),
          showGallery: (images) => {
            if (!isActive()) return;
            typeWrite(
              `Opening gallery (${images.length}):\n` +
              images.map((u, i) => `  [${i + 1}] ${u}`).join("\n")
            );
          },
          isAuthed: () => !!isSignedIn,
          isAdmin: () => isAdmin,
        });

        // builtin clear (not in help)
        eng.register({
          name: "clear",
          aliases: ["cls"],
          description: "Clear the terminal",
          actions: [],
          requiresAuth: false,
          role: "user",
          showInHelp: false,
          enabled: true,
          rateLimitPerMin: 0,
        });

        if (rows.length) {
          rows
            // keep enabled or undefined; only drop if explicitly false/0/"false"
            .filter((r: any) => toBool(r?.enabled, true))
            .forEach((r: any, idx: number) => {
              // normalize actions whether stringified JSON or array
              let acts: any[] = [];
              if (Array.isArray(r.actions)) {
                acts = r.actions;
              } else if (typeof r.actions === "string") {
                try {
                  const parsed = JSON.parse(r.actions);
                  if (Array.isArray(parsed)) acts = parsed;
                } catch (e) {
                  warn("actions JSON parse failed", { idx, name: r?.name, actions: r.actions, e });
                }
              }

              const item = {
                name: String(r.name || "").toLowerCase(),
                aliases: Array.isArray(r.aliases) ? r.aliases.map((a: string) => a.toLowerCase()) : [],
                description: r.description || "",
                actions: acts,
                requiresAuth: toBool(r.requires_auth, false),
                role: r.role === "admin" ? "admin" : "user",
                showInHelp: toBool(r.show_in_help, true),
                enabled: toBool(r.enabled, true),
                rateLimitPerMin: typeof r.rate_limit_per_min === "number" ? r.rate_limit_per_min : 0,
              };

              info("register", {
                idx,
                name: item.name,
                enabled: item.enabled,
                showInHelp: item.showInHelp,
                actionsCount: item.actions?.length ?? 0,
              });

              eng.register(item as any);
            });
        }

        if (!cancelled) {
          engineRef.current = eng;

          const finalList = eng.list();
          const real = finalList.filter(c => c.name !== "clear");
          setIsReady(real.length > 0);

          info("registry:final", {
            total: finalList.length,
            realCommands: real.length,
            names: real.map((c) => c.name),
          });

          try {
            (window as any).__TERMINAL_DEBUG__ = {
              list: () => eng.list(),
              names: () => eng.list().map((c) => c.name),
            };
          } catch {}

          console.timeEnd("[TERMINAL] fetch+build");
        }
      } catch (e) {
        error("fetch/build error", e);
        await typeWrite("Failed to load commands from database.");
      }
    }

    loadAndBuild();
    return () => { cancelled = true; };
  }, [print, typeWrite, isActive, isSignedIn, isAdmin, playAudioIf, showVideoIf, router]);

  return { engineRef, isReady };
}
