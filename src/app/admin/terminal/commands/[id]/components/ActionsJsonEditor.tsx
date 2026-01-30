// src/app/admin/terminal/commands/[id]/components/ActionsJsonEditor.tsx
"use client";

import { Textarea } from "@/components/ui/textarea";

export default function ActionsJsonEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Textarea
        className={[
          "min-h-[280px] font-mono text-xs leading-relaxed",
          "border-white/10 bg-black/30 text-white placeholder:text-white/40",
          "focus-visible:ring-2 focus-visible:ring-white/30",
        ].join(" ")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        placeholder='[{"type":"navigate","href":"/blog"}]'
      />

      <div className="space-y-2 text-[11px] text-white/60">
        <div className="font-semibold text-white/70">Supported shapes</div>

        <code className="block rounded-md border border-white/10 bg-white/5 px-3 py-2">
          {`[{"type":"navigate","href":"/blog"}]`}
        </code>
        <code className="block rounded-md border border-white/10 bg-white/5 px-3 py-2">
          {`[{"type":"openUrl","url":"https://example.com","newTab":true}]`}
        </code>
        <code className="block rounded-md border border-white/10 bg-white/5 px-3 py-2">
          {`[{"type":"audio","src":"https://.../file.mp3"}]`}
        </code>
        <code className="block rounded-md border border-white/10 bg-white/5 px-3 py-2">
          {`[{"type":"video","src":"https://.../clip.mp4"}]`}
        </code>
        <code className="block rounded-md border border-white/10 bg-white/5 px-3 py-2">
          {`[{"type":"gallery","images":["https://.../image.jpg"]}]`}
        </code>
      </div>
    </div>
  );
}
