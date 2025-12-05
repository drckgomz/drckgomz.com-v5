// frontend/src/features/terminal/hooks/useTerminalIO.ts
"use client";

import * as React from "react";

export type Line = { text: string };

export function useTerminalIO() {
  const [lines, setLines] = React.useState<Line[]>([
    { text: "Welcome to DRCKGOMZ terminal. Type `help`." },
  ]);

  // queue + pointers
  const writerQueueRef = React.useRef<Promise<void>>(Promise.resolve());
  const activeLineIndexRef = React.useRef<number>(-1);

  // session refs
  const writerSessionRef = React.useRef(0);        // cancels typewriter
  const activeCommandSessionRef = React.useRef(0); // gates side-effects

  // guard used by side-effects
  const isActive = React.useCallback(
    () => writerSessionRef.current === activeCommandSessionRef.current,
    []
  );

  // gated print
  const print = React.useCallback((t: string) => {
    if (!isActive()) return;
    setLines((p) => [...p, { text: t }]);
  }, [isActive]);

  const TYPE_SPEED_MS = 15;
  const typeWrite = React.useCallback(
    (text: string, speed = TYPE_SPEED_MS, newlineAfter = true): Promise<void> => {
      const mySession = writerSessionRef.current;

      writerQueueRef.current = writerQueueRef.current.then(
        () =>
          new Promise<void>((resolve) => {
            if (writerSessionRef.current !== mySession) return resolve();

            setLines((prev) => {
              if (writerSessionRef.current !== mySession) return prev;
              activeLineIndexRef.current = prev.length;
              return [...prev, { text: "" }];
            });

            let i = 0;
            const step = () => {
              if (writerSessionRef.current !== mySession) return resolve();

              const ch = text[i++];

              if (ch === "\n") {
                setLines((prev) => {
                  if (writerSessionRef.current !== mySession) return prev;
                  activeLineIndexRef.current = prev.length;
                  return [...prev, { text: "" }];
                });
              } else {
                const idx = activeLineIndexRef.current;
                setLines((prev) => {
                  if (writerSessionRef.current !== mySession) return prev;
                  const copy = prev.slice();
                  if (!copy[idx]) copy[idx] = { text: "" };
                  copy[idx] = { text: (copy[idx].text ?? "") + ch };
                  return copy;
                });
              }

              if (i < text.length) {
                setTimeout(step, speed);
              } else {
                if (newlineAfter) {
                  setLines((prev) => {
                    if (writerSessionRef.current !== mySession) return prev;
                    return [...prev, { text: "" }];
                  });
                }
                resolve();
              }
            };

            setTimeout(step, speed);
          })
      );

      return writerQueueRef.current;
    },
    []
  );

  // hard cancel everything + clear screen
  const clearTerminal = React.useCallback(() => {
    writerSessionRef.current += 1;       // cancel in-flight writers
    activeLineIndexRef.current = -1;
    // drop any queued writes so nothing else runs
    writerQueueRef.current = Promise.resolve();
    setLines([]);
    // invalidate running command’s side-effects
    activeCommandSessionRef.current = -1;
  }, []);

  // call right before engine.execute()
  const beginCommandSession = React.useCallback(() => {
    activeCommandSessionRef.current = writerSessionRef.current;
  }, []);

  return {
    lines,
    setLines, // (rarely needed outside)
    print,
    typeWrite,
    clearTerminal,
    beginCommandSession,
    isActive,
  };
}
