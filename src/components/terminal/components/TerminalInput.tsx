// src/components/terminal/components/TerminalInput.tsx
"use client";

import * as React from "react";

type InputRef =
  | React.RefObject<HTMLInputElement>
  | React.MutableRefObject<HTMLInputElement | null>;

type Props = {
  input: string;
  setInput: (v: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  inputRef: InputRef;
  history: string[];
  historyIndex: number;
  setHistoryIndex: (n: number) => void;
  setInputFromHistory: (cmd: string) => void;
};

export default function TerminalInput({
  input,
  setInput,
  handleSubmit,
  inputRef,
  history,
  historyIndex,
  setHistoryIndex,
  setInputFromHistory,
}: Props) {
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex > 0) {
        const i = historyIndex - 1;
        setHistoryIndex(i);
        setInputFromHistory(history[i]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        const i = historyIndex + 1;
        setHistoryIndex(i);
        setInputFromHistory(history[i]);
      } else {
        setHistoryIndex(history.length);
        setInputFromHistory("");
      }
    }
  }

  return (
    <div
      id="input-line"
      className="flex items-center px-4 py-2 border-t border-white/10 bg-black/40"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
      }}
    >
      <span className="text-prompt-color font-bold text-base md:text-lg mr-2">&gt;</span>

      <form onSubmit={handleSubmit} className="w-full">
        <input
          ref={inputRef}
          id="terminal-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          className="w-full bg-transparent outline-none text-prompt-color border-0 pl-2 text-[16px] md:text-base"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          aria-label="Terminal input"
          inputMode="text"
        />
      </form>
    </div>
  );
}
