// src/app/admin/terminal/commands/[id]/CommandEditor.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import type { Cmd, ActionKind } from "./types";
import { buildActionsFromBuilder, inferBuilderFromActions } from "./utils";

import HeaderBar from "./components/HeaderBar";
import IdentityForm from "./components/IdentityForm";
import FlagsRow from "./components/FlagsRow";
import CommandBuilder from "./components/CommandBuilder";
import ActionsJsonEditor from "./components/ActionsJsonEditor";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function safeParseActions(v: unknown): any[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export default function CommandEditor({ id }: { id: string }) {
  const router = useRouter();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [cmd, setCmd] = React.useState<Cmd | null>(null);

  // simple builder
  const [actionKind, setActionKind] = React.useState<ActionKind>("navigate");
  const [targetUrl, setTargetUrl] = React.useState("");
  const [newTab, setNewTab] = React.useState(true);

  // advanced
  const [actionsText, setActionsText] = React.useState("[]");
  const [aliasesText, setAliasesText] = React.useState("");

  // ✅ important: don't overwrite JSON if user edits it directly
  const [advancedDirty, setAdvancedDirty] = React.useState(false);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/terminal/commands/${id}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        const c: Cmd | null = json?.command ?? null;

        if (!alive) return;

        setCmd(c);
        setAliasesText((c?.aliases || []).join(", "));

        const acts = safeParseActions(c?.actions);
        setActionsText(JSON.stringify(acts, null, 2));
        setAdvancedDirty(false);

        const inferred = inferBuilderFromActions(acts);
        setActionKind(inferred.kind);
        setTargetUrl(inferred.targetUrl);
        setNewTab(inferred.newTab);
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  // keep JSON in sync with builder only when user hasn't started editing advanced JSON
  React.useEffect(() => {
    if (advancedDirty) return;
    const arr = buildActionsFromBuilder(actionKind, targetUrl, newTab);
    setActionsText(JSON.stringify(arr, null, 2));
  }, [actionKind, targetUrl, newTab, advancedDirty]);

  const onCmdPatch = (patch: Partial<Cmd>) => {
    setCmd((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const patch = async () => {
    if (!cmd) return;

    setSaving(true);
    try {
      let parsedActions: any[] = [];
      try {
        parsedActions = JSON.parse(actionsText || "[]");
        if (!Array.isArray(parsedActions)) throw new Error("actions must be an array");
      } catch (e: any) {
        alert(`Invalid actions JSON: ${e.message}`);
        return;
      }

      const aliases = aliasesText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch(`/api/admin/terminal/commands/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cmd.name,
          description: cmd.description,
          role: cmd.role,
          requires_auth: cmd.requires_auth,
          show_in_help: cmd.show_in_help,
          enabled: cmd.enabled,
          rate_limit_per_min: cmd.rate_limit_per_min,
          aliases,
          actions: parsedActions, // API stores it correctly (stringified in DB)
        }),
      });

      const text = await res.text();
      if (!res.ok) throw new Error(text || "Save failed");

      const json = JSON.parse(text);
      const updated: Cmd | null = json?.command ?? null;

      if (updated) {
        setCmd(updated);
        // reflect any server-side normalization
        const acts = safeParseActions(updated.actions);
        setActionsText(JSON.stringify(acts, null, 2));
        setAdvancedDirty(false);

        const inferred = inferBuilderFromActions(acts);
        setActionKind(inferred.kind);
        setTargetUrl(inferred.targetUrl);
        setNewTab(inferred.newTab);

        setAliasesText((updated.aliases || []).join(", "));
      }

      alert("Saved!");
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!confirm("Delete this command?")) return;
    const res = await fetch(`/api/admin/terminal/commands/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/terminal/commands");
    else {
      const t = await res.text().catch(() => "");
      alert(t || "Delete failed");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!cmd) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 text-sm text-muted-foreground">
        Not found.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      <HeaderBar saving={saving} onBack={() => router.back()} onDelete={del} onSave={patch} />

      <Separator />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 bg-background/60">
          <CardHeader>
            <CardTitle className="text-base">Identity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <IdentityForm
              cmd={cmd}
              onChange={onCmdPatch}
              aliasesText={aliasesText}
              setAliasesText={(v) => {
                setAliasesText(v);
              }}
            />
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-background/60">
          <CardHeader>
            <CardTitle className="text-base">Flags</CardTitle>
          </CardHeader>
          <CardContent>
            <FlagsRow cmd={cmd} onChange={onCmdPatch} />
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-background/60 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Action Builder</CardTitle>
          </CardHeader>
          <CardContent>
            <CommandBuilder
              actionKind={actionKind}
              setActionKind={(k) => {
                setAdvancedDirty(false); // builder owns JSON again
                setActionKind(k);
              }}
              targetUrl={targetUrl}
              setTargetUrl={(v) => {
                setAdvancedDirty(false);
                setTargetUrl(v);
              }}
              newTab={newTab}
              setNewTab={(v) => {
                setAdvancedDirty(false);
                setNewTab(v);
              }}
              actionsPreview={actionsText}
            />
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-background/60 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Actions JSON</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionsJsonEditor
              value={actionsText}
              onChange={(v) => {
                setAdvancedDirty(true);
                setActionsText(v);
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
