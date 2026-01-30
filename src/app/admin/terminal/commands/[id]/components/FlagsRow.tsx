// src/app/admin/terminal/commands/[id]/components/FlagsRow.tsx
"use client";

import type { Cmd } from "../types";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

function Row({
  id,
  checked,
  onCheckedChange,
  label,
  hint,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-white/10 bg-white/5 p-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="mt-0.5"
      />
      <div className="min-w-0">
        <Label htmlFor={id} className="cursor-pointer text-sm text-white">
          {label}
        </Label>
        {hint ? <p className="mt-1 text-[11px] text-white/50">{hint}</p> : null}
      </div>
    </div>
  );
}

export default function FlagsRow({
  cmd,
  onChange,
}: {
  cmd: Cmd;
  onChange: (patch: Partial<Cmd>) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Row
        id="enabled"
        checked={!!cmd.enabled}
        onCheckedChange={(v) => onChange({ enabled: v })}
        label="Enabled"
        hint="If off, the command won’t run."
      />
      <Row
        id="show_in_help"
        checked={!!cmd.show_in_help}
        onCheckedChange={(v) => onChange({ show_in_help: v })}
        label="Show in help"
        hint="Controls whether it appears in the help list."
      />
      <Row
        id="requires_auth"
        checked={!!cmd.requires_auth}
        onCheckedChange={(v) => onChange({ requires_auth: v })}
        label="Requires auth"
        hint="Signed-out users won’t be able to run it."
      />
    </div>
  );
}
