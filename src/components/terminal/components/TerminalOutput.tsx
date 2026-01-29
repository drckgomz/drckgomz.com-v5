// frontend/src/features/terminal/components/TerminalOutput.tsx

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
      id="terminal-output"
      ref={outputRef}
      className="text-sm md:text-base leading-6 whitespace-pre-wrap text-prompt-color p-6 h-[40dvh] md:h-[30vh] overflow-y-auto font-bold"
    >
      {lines.map((l, i) => (l ? <div key={i}>{l.text ?? ""}</div> : null))}
    </div>
  );
}
