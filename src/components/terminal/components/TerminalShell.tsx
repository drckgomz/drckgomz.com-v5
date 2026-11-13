"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import TerminalOutput from "@/components/terminal/components/TerminalOutput";
import TerminalInput from "@/components/terminal/components/TerminalInput";
import { useTerminalIO } from "@/components/terminal/hooks/useTerminalIO";
import { interpretTerminalCommand } from "@/lib/terminal/safe-command";

/** Fixed allowlist interpreter: commands are data and never reach a shell. */
export default function TerminalShell() {
  const router = useRouter();
  const { lines, typeWrite, clearTerminal } = useTerminalIO();
  const [input, setInput] = React.useState("");
  const [history, setHistory] = React.useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = input.trim();
    setInput("");
    if (!raw) return;
    setHistory((previous) => [...previous.slice(-49), raw]);
    setHistoryIndex(history.length + 1);
    const result = interpretTerminalCommand(raw);
    if (result.kind === "clear") {
      clearTerminal();
      return;
    }
    if (result.kind === "navigate") {
      await typeWrite(`> ${raw}\n${result.message}`);
      router.push(result.href);
      return;
    }
    await typeWrite(`> ${raw}\n${result.text}`);
  }

  return (
    <main className="terminal-shell mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col justify-end px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8">
      <section className="terminal-shell__screen overflow-hidden rounded-lg border border-white/20 bg-black/65 shadow-2xl backdrop-blur-sm" aria-label="Terminal session">
        <TerminalOutput lines={lines} />
        <TerminalInput
          input={input}
          setInput={setInput}
          handleSubmit={onSubmit}
          inputRef={inputRef}
          history={history}
          historyIndex={historyIndex}
          setHistoryIndex={setHistoryIndex}
          setInputFromHistory={setInput}
        />
      </section>
    </main>
  );
}
