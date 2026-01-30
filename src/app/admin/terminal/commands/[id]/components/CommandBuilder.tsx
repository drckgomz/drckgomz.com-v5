// src/app/admin/terminal/commands/[id]/components/CommandBuilder.tsx
"use client";

import * as React from "react";
import type { ActionKind } from "../types";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CommandBuilder({
  actionKind,
  setActionKind,
  targetUrl,
  setTargetUrl,
  newTab,
  setNewTab,
  actionsPreview,
}: {
  actionKind: ActionKind;
  setActionKind: (k: ActionKind) => void;
  targetUrl: string;
  setTargetUrl: (v: string) => void;
  newTab: boolean;
  setNewTab: (v: boolean) => void;
  actionsPreview: string;
}) {
  const label =
    actionKind === "navigate"
      ? "Internal path (href)"
      : actionKind === "openUrl"
      ? "External URL"
      : actionKind === "audio"
      ? "Audio URL"
      : actionKind === "video"
      ? "Video URL"
      : "Image URL";

  const placeholder = actionKind === "navigate" ? "/blog" : "https://example.com";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2 sm:col-span-1">
          <Label className="text-xs font-medium text-white/80">Command type</Label>
          <Select value={actionKind} onValueChange={(v) => setActionKind(v as ActionKind)}>
            <SelectTrigger className="border-white/10 bg-white/5 text-white">
              <SelectValue placeholder="Select a type" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-black text-white">
              <SelectItem value="navigate">Navigate (internal)</SelectItem>
              <SelectItem value="openUrl">Open external URL</SelectItem>
              <SelectItem value="audio">Play audio</SelectItem>
              <SelectItem value="video">Show video</SelectItem>
              <SelectItem value="image">Show image (gallery)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label className="text-xs font-medium text-white/80">{label}</Label>
          <Input
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder={placeholder}
            className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode={actionKind === "navigate" ? "text" : "url"}
          />
          {actionKind === "navigate" && targetUrl && !targetUrl.startsWith("/") && (
            <p className="text-[11px] text-amber-200/80">
              Tip: internal paths usually start with{" "}
              <code className="font-mono text-white/80">/</code>
            </p>
          )}
        </div>
      </div>

      {actionKind === "openUrl" && (
        <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 p-3">
          <Checkbox checked={newTab} onCheckedChange={(v) => setNewTab(Boolean(v))} id="newTab" />
          <Label htmlFor="newTab" className="cursor-pointer text-sm text-white">
            Open in new tab
          </Label>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs font-medium text-white/80">
          Preview{" "}
          <span className="font-normal text-white/40">(actions JSON that will be saved)</span>
        </Label>

        <pre className="rounded-md border border-white/10 bg-black/30 p-3 text-xs text-white/90 overflow-x-auto">
          {actionsPreview}
        </pre>

        <div className="text-[11px] text-white/60">
          Maps to your terminal engine:
          <ul className="mt-1 list-disc pl-5 space-y-1">
            <li>
              <code className="font-mono text-white/80">navigate</code> →{" "}
              <code className="font-mono text-white/80">
                {"{ type: 'navigate', href }"}
              </code>
            </li>
            <li>
              <code className="font-mono text-white/80">openUrl</code> →{" "}
              <code className="font-mono text-white/80">
                {"{ type: 'openUrl', url, newTab }"}
              </code>
            </li>
            <li>
              <code className="font-mono text-white/80">audio</code> →{" "}
              <code className="font-mono text-white/80">{"{ type: 'audio', src }"}</code>
            </li>
            <li>
              <code className="font-mono text-white/80">video</code> →{" "}
              <code className="font-mono text-white/80">{"{ type: 'video', src }"}</code>
            </li>
            <li>
              <code className="font-mono text-white/80">image</code> →{" "}
              <code className="font-mono text-white/80">
                {"{ type: 'gallery', images: [url] }"}
              </code>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
