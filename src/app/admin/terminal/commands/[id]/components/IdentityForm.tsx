// src/app/admin/terminal/commands/[id]/components/IdentityForm.tsx
"use client";

import type { Cmd } from "../types";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function IdentityForm({
  cmd,
  onChange,
  aliasesText,
  setAliasesText,
}: {
  cmd: Cmd;
  onChange: (patch: Partial<Cmd>) => void;
  aliasesText: string;
  setAliasesText: (s: string) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label className="text-xs font-medium text-white/80">
          Command prompt{" "}
          <span className="font-normal text-white/40">
            (e.g. <code className="font-mono text-[11px] text-white/70">youtube</code>)
          </span>
        </Label>
        <Input
          value={cmd.name ?? ""}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="command"
          className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-white/80">Role</Label>
        <Input
          value={(cmd.role ?? "user") as any}
          onChange={(e) => onChange({ role: e.target.value as any })}
          placeholder="user | admin"
          className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <p className="text-[11px] text-white/50">Controls who can run the command.</p>
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label className="text-xs font-medium text-white/80">Description</Label>
        <Input
          value={cmd.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="What this command does"
          className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label className="text-xs font-medium text-white/80">Aliases (comma-separated)</Label>
        <Input
          value={aliasesText}
          onChange={(e) => setAliasesText(e.target.value)}
          placeholder="yt, tube"
          className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <p className="text-[11px] text-white/50">These will be treated as the same command.</p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-white/80">Rate limit per min</Label>
        <Input
          type="number"
          inputMode="numeric"
          value={Number(cmd.rate_limit_per_min ?? 0)}
          onChange={(e) => onChange({ rate_limit_per_min: Number(e.target.value) || 0 })}
          className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
        />
        <p className="text-[11px] text-white/50">0 = no rate limit.</p>
      </div>
    </>
  );
}
