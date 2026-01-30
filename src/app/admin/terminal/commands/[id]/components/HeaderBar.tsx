// src/app/admin/terminal/commands/[id]/components/HeaderBar.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function HeaderBar({
  saving,
  onBack,
  onDelete,
  onSave,
}: {
  saving: boolean;
  onBack: () => void;
  onDelete: () => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-white/50">Admin / Terminal</p>
          <h1 className="truncate text-2xl font-bold text-white">Edit Command</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="bg-white/10 text-white hover:bg-white hover:text-black"
            onClick={onBack}
            disabled={saving}
          >
            ← Back
          </Button>

          <Button
            type="button"
            variant="destructive"
            className="bg-red-500/20 text-red-200 hover:bg-red-400 hover:text-black"
            onClick={onDelete}
            disabled={saving}
          >
            Delete
          </Button>

          <Button
            type="button"
            className="bg-white/25 hover:bg-white hover:text-black"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <Separator className="bg-white/10" />
    </div>
  );
}
