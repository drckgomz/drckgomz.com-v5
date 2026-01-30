// src/components/terminal/components/TerminalOutput.tsx
"use client";

import * as React from "react";
import type { Line } from "@/components/terminal/hooks/useTerminalIO";

export default function TerminalOutput({ lines }: { lines: Line[] }) {
  const outputRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = outputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div
      id="terminal-output"
      ref={outputRef}
      className="flex-1 text-[13px] sm:text-sm leading-6 whitespace-pre-wrap text-prompt-color px-4 py-4 sm:px-6 sm:py-6 overflow-y-auto font-semibold"
      style={{
        WebkitOverflowScrolling: "touch",
      }}
    >
      {lines.map((l, i) => (l ? <div key={i}>{l.text ?? ""}</div> : null))}
    </div>
  );
}
