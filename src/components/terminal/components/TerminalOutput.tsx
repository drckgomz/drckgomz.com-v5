// src/components/terminal/components/TerminalOutput.tsx
"use client";

import * as React from "react";
import type { Line } from "@/components/terminal/hooks/useTerminalIO";

export default function TerminalOutput({ lines }: { lines: Line[] }) {
  const outputRef = React.useRef<HTMLDivElement>(null!);

  React.useEffect(() => {
    const el = outputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div
      ref={outputRef}
      className="text-xs sm:text-sm leading-5 whitespace-pre-wrap text-prompt-color px-4 py-3 h-[260px] overflow-y-auto font-bold"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {lines.map((l, i) => (l ? <div key={i}>{l.text ?? ""}</div> : null))}
    </div>
  );
}
