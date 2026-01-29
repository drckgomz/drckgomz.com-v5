// src/app/admin/terminal/commands/page.client.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/utils";

type Cmd = {
  id: number;
  name: string;
  aliases: string[];
  description: string;
  actions: any; // string or array
  requires_auth: boolean;
  role: string;
  show_in_help: boolean;
  enabled: boolean;
  rate_limit_per_min: number;
  updated_at?: string;
};

function safeParseArray(v: unknown): any[] {
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

function normalizeCmd(raw: any): Cmd {
  return {
    id: Number(raw?.id ?? 0),
    name: String(raw?.name ?? ""),
    aliases: Array.isArray(raw?.aliases)
      ? raw.aliases.map(String)
      : typeof raw?.aliases === "string"
      ? raw.aliases.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [],
    description: String(raw?.description ?? ""),
    actions: raw?.actions ?? "[]",
    requires_auth: Boolean(raw?.requires_auth),
    role: String(raw?.role ?? "user"),
    show_in_help: Boolean(raw?.show_in_help),
    enabled: Boolean(raw?.enabled),
    rate_limit_per_min: Number(raw?.rate_limit_per_min ?? 0),
    updated_at: raw?.updated_at ? String(raw.updated_at) : undefined,
  };
}

function Pill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
        "border-white/10 bg-white/5 text-white/70",
        className
      )}
    >
      {children}
    </span>
  );
}

function EnabledBadge({ enabled }: { enabled: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full border",
        enabled
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          : "border-red-500/30 bg-red-500/10 text-red-200"
      )}
    >
      {enabled ? "ENABLED" : "DISABLED"}
    </Badge>
  );
}

function RoleBadge({ role }: { role: string }) {
  const r = (role || "user").toLowerCase();
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full border",
        r === "admin"
          ? "border-purple-500/30 bg-purple-500/10 text-purple-200"
          : "border-white/10 bg-white/5 text-white/70"
      )}
    >
      {r.toUpperCase()}
    </Badge>
  );
}

export default function ManageTerminalCommandsPageClient() {
  const router = useRouter();

  const [rows, setRows] = React.useState<Cmd[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/terminal/commands?limit=200&offset=0", {
        cache: "no-store",
      });

      const text = await res.text();
      if (!res.ok) throw new Error(`API ${res.status}: ${text.slice(0, 300)}`);

      const json = JSON.parse(text);
      const list: any[] = Array.isArray(json)
        ? json
        : Array.isArray(json?.commands)
        ? json.commands
        : Array.isArray(json?.items)
        ? json.items
        : [];

      setRows(list.map(normalizeCmd));
    } catch (e: any) {
      console.error("[admin commands] load failed:", e);
      setError(e?.message ?? "Failed to load commands");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const onCreate = async () => {
    try {
      const res = await fetch("/api/admin/terminal/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "new-command", description: "", actions: [] }),
      });

      const text = await res.text();
      if (!res.ok) throw new Error(`Create failed (${res.status}): ${text}`);

      const json = JSON.parse(text);
      const command = json?.command ?? json;

      if (!command?.id) {
        throw new Error(`Create returned unexpected payload: ${text.slice(0, 200)}`);
      }

      router.push(`/admin/terminal/commands/${command.id}`);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Create failed");
    }
  };

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;

    return rows.filter((c) => {
      const aliases = (c.aliases || []).join(", ").toLowerCase();
      const desc = (c.description || "").toLowerCase();
      const flags = [
        c.enabled ? "enabled" : "disabled",
        c.show_in_help ? "show_in_help" : "hidden",
        c.requires_auth ? "requires_auth" : "no_auth",
        (c.role || "user").toLowerCase(),
      ].join(" ");

      return (
        c.name.toLowerCase().includes(needle) ||
        aliases.includes(needle) ||
        desc.includes(needle) ||
        flags.includes(needle)
      );
    });
  }, [rows, q]);

  return (
    <main
      className={cn(
        // Hard force dark, even if layout sets light theme wrappers
        "min-h-dvh text-white",
        "bg-[#050608]",
        "bg-[radial-gradient(80%_60%_at_50%_0%,rgba(125,253,254,0.10),transparent_60%),radial-gradient(60%_60%_at_0%_20%,rgba(255,255,255,0.06),transparent_55%)]"
      )}
    >
      <div className="pt-5 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          {/* Header row */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight">Commands</h1>
              <p className="mt-1 text-xs text-white/60">
                {loading
                  ? "Loading…"
                  : `${rows.length} command(s) loaded • Use search to filter by name, alias, description, or flags.`}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                className="bg-white/5 text-white border border-white/20 hover:bg-white hover:text-black"
                onClick={load}
                disabled={loading}
              >
                Refresh
              </Button>

              <Button
                type="button"
                className="bg-white/5 text-white border border-white/20 hover:bg-white hover:text-black"
                onClick={onCreate}
              >
                + New command
              </Button>

              <Button
                type="button"
                variant="secondary"
                className="bg-white/5 text-white border border-white/20 hover:bg-white hover:text-black"
                onClick={() => router.back()}
              >
                ← Back
              </Button>
            </div>
          </div>

          {/* Force dark card (don’t rely on theme tokens) */}
          <Card className="rounded-2xl border border-white/10 bg-black/40 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-white">Commands</CardTitle>
              <CardDescription className="text-xs text-white/60">
                Showing <span className="font-semibold text-white">{filtered.length}</span> result(s)
              </CardDescription>
            </CardHeader>

            <Separator className="bg-white/10" />

            <CardContent className="pt-4">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-white/60">
                  {loading ? "Loading…" : `Showing ${filtered.length} result(s)`}
                </div>

                <div className="w-full sm:w-[420px]">
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search name, aliases, description, role…"
                    className={cn(
                      "h-9 text-sm",
                      // hard dark input
                      "bg-black/40 border border-white/10 text-white",
                      "placeholder:text-white/40",
                      "focus-visible:ring-2 focus-visible:ring-white/25"
                    )}
                  />
                </div>
              </div>

              {error ? (
                <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  error: {error}
                </div>
              ) : null}

              <div className="rounded-2xl border border-white/10 bg-black/30 overflow-hidden">
                {loading ? (
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-10 w-full bg-white/5" />
                    <Skeleton className="h-10 w-full bg-white/5" />
                    <Skeleton className="h-10 w-full bg-white/5" />
                    <Skeleton className="h-10 w-full bg-white/5" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-white/60">No commands found.</div>
                ) : (
                  <ul className="divide-y divide-white/10">
                    {filtered.map((c) => {
                      const actionsCount = safeParseArray(c.actions).length;
                      const updated = c.updated_at
                        ? new Date(c.updated_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : null;

                      return (
                        <li
                          key={c.id}
                          className={cn(
                            "flex items-center justify-between gap-4 px-4 py-3",
                            "hover:bg-white/[0.04] transition-colors"
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold text-white">
                                {c.name}
                              </span>
                            </div>

                            <div className="mt-0.5 flex flex-wrap items-center gap-2">
                              <span className="text-[11px] text-white/50">
                                id: {c.id}
                                {updated ? ` • updated ${updated}` : ""}
                              </span>
                              <Pill>actions: {actionsCount}</Pill>
                              {c.show_in_help ? (
                                <Pill>show in help</Pill>
                              ) : (
                                <Pill className="text-white/50">hidden</Pill>
                              )}
                              {c.requires_auth ? <Pill>requires auth</Pill> : null}
                            </div>

                            <div className="mt-1.5 truncate text-xs text-white/70">
                              {c.description || (
                                <span className="text-white/40">(no description)</span>
                              )}
                            </div>

                            <div className="mt-1 truncate text-[11px] text-white/45">
                              aliases: {(c.aliases || []).length ? c.aliases.join(", ") : "(none)"}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <RoleBadge role={c.role} />
                            <EnabledBadge enabled={!!c.enabled} />
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="h-8 bg-white/5 text-white border border-white/20 hover:bg-white hover:text-black"
                              onClick={() => router.push(`/admin/terminal/commands/${c.id}`)}
                            >
                              Edit
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
