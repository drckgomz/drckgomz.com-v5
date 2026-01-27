// src/app/admin/users/UsersTable.tsx
"use client";

import * as React from "react";
import type { MeProfile, ProfileRow } from "./types";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function roleLabel(u: ProfileRow) {
  const isAdmin = u.is_owner || String(u.role || "").toLowerCase() === "admin";
  if (u.is_owner) return "Owner";
  if (isAdmin) return "Admin";
  return "User";
}

function roleBadgeClass(u: ProfileRow) {
  const isAdmin = u.is_owner || String(u.role || "").toLowerCase() === "admin";
  return u.is_owner
    ? "border-yellow-400/60 text-yellow-200 bg-yellow-900/30 uppercase"
    : isAdmin
    ? "border-emerald-400/60 text-emerald-200 bg-emerald-900/30 uppercase"
    : "border-slate-500/60 text-slate-200 bg-slate-900/30 uppercase";
}

export function UsersTable({
  me,
  users,
  loading,
  onPatch,
}: {
  me: MeProfile | null;
  users: ProfileRow[];
  loading: boolean;
  onPatch: (id: string, body: Record<string, unknown>) => Promise<void>;
}) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const full = `${u.first_name} ${u.last_name}`.toLowerCase();
      return (
        u.email.toLowerCase().includes(q) ||
        (u.username ?? "").toLowerCase().includes(q) ||
        full.includes(q)
      );
    });
  }, [users, query]);

  const [banOpen, setBanOpen] = React.useState(false);
  const [banReason, setBanReason] = React.useState("");
  const [banTarget, setBanTarget] = React.useState<ProfileRow | null>(null);

  const openBan = (u: ProfileRow) => {
    setBanTarget(u);
    setBanReason(u.banned_reason ?? "");
    setBanOpen(true);
  };

  const doPatch = async (u: ProfileRow, body: Record<string, unknown>) => {
    await onPatch(u.id, { email: u.email, ...body });
  };

  return (
    <div className="space-y-4">
      {/* Search row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-white/60">
          {loading ? "Loading users…" : `${filtered.length} user${filtered.length === 1 ? "" : "s"}`}
        </div>
        <div className="w-full sm:w-[360px]">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email, name, or username…"
            className="h-9 text-sm bg-white/5 border border-white/10 text-white placeholder:text-white/40"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <Table>
          <TableHeader className="bg-white/5">
            <TableRow className="border-white/10">
              <TableHead className="w-[420px] text-white/70">User</TableHead>
              <TableHead className="text-white/70">Role</TableHead>
              <TableHead className="text-white/70">Status</TableHead>
              <TableHead className="text-center text-white/70">Private</TableHead>
              <TableHead className="text-center text-white/70">Admin</TableHead>
              <TableHead className="text-center text-white/70">Banned</TableHead>
              <TableHead className="text-right text-white/70">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow className="border-white/10">
                <TableCell colSpan={7} className="py-8 text-center text-sm text-white/60">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow className="border-white/10">
                <TableCell colSpan={7} className="py-8 text-center text-sm text-white/60">
                  No users match your current filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => {
                const isSelf = me?.id === u.id;
                const isOwner = u.is_owner;
                const isAdmin = isOwner || String(u.role || "").toLowerCase() === "admin";

                // Safety rules (same spirit as your v4)
                const canEditAdmin = !isOwner && !isSelf;
                const canEditPrivate = !isOwner;
                const canEditBanned = !isOwner && !isSelf;
                const canMakeOwner = !!me?.is_owner && !u.is_owner;

                const name =
                  u.first_name || u.last_name
                    ? `${u.first_name} ${u.last_name}`.trim()
                    : u.username
                    ? u.username
                    : "(no name)";

                return (
                  <TableRow
                    key={u.id}
                    className={[
                        "border-white/10",
                        // darker, easier hover (no big white flash)
                        "hover:bg-white/5 data-[state=selected]:bg-white/8",
                        // optional: make text stay readable on hover
                        "hover:text-white",
                        // keep your banned tint, but let hover still work
                        u.is_banned ? "bg-red-950/20 hover:bg-red-950/30" : "",
                    ].join(" ")}
                    >

                    {/* identity */}
                    <TableCell className="py-3 align-top">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-white">{name}</span>
                          {u.username ? (
                            <span className="text-xs text-white/50">@{u.username}</span>
                          ) : null}
                          {isSelf ? (
                            <Badge variant="outline" className="border-blue-400/60 text-blue-200 bg-blue-900/20 uppercase text-[10px]">
                              You
                            </Badge>
                          ) : null}
                        </div>
                        <div className="text-xs text-white/70 break-all">{u.email}</div>
                        <div className="text-[10px] text-white/40 break-all">
                          id: {u.id}
                          {u.created_at ? ` · created ${new Date(u.created_at).toLocaleString()}` : ""}
                        </div>
                      </div>
                    </TableCell>

                    {/* role */}
                    <TableCell className="align-top">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className={roleBadgeClass(u)}>
                          {roleLabel(u)}
                        </Badge>
                        {!u.enabled ? (
                          <Badge variant="outline" className="border-slate-400/60 text-slate-200 bg-slate-900/30 uppercase">
                            Disabled
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>

                    {/* status */}
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1 text-xs">
                        {u.is_banned ? (
                          <span className="text-red-300">
                            BANNED{u.banned_reason ? ` · ${u.banned_reason}` : ""}
                          </span>
                        ) : (
                          <span className="text-emerald-300">Active</span>
                        )}
                        {u.can_view_private && !u.is_banned ? (
                          <span className="text-purple-200/80">Can view private posts</span>
                        ) : null}
                      </div>
                    </TableCell>

                    {/* private */}
                    <TableCell className="align-top text-center">
                      <Switch
                        checked={!!u.can_view_private}
                        disabled={!canEditPrivate || u.is_banned}
                        onCheckedChange={(next) => doPatch(u, { can_view_private: next })}
                        className="
                            bg-white/5
                            data-[state=checked]:bg-emerald-500/80
                            data-[state=unchecked]:bg-white/5
                            border border-white/10
                        "
                      />
                    </TableCell>

                    {/* admin */}
                    <TableCell className="align-top text-center">
                      <Switch
                        checked={isAdmin}
                        disabled={!canEditAdmin || u.is_banned}
                        onCheckedChange={(next) => doPatch(u, { role: next ? "admin" : "user" })}
                        className="
                            bg-white/5
                            data-[state=checked]:bg-emerald-500/80
                            data-[state=unchecked]:bg-white/5
                            border border-white/10
                        "
                      />
                    </TableCell>

                    {/* banned */}
                    <TableCell className="align-top text-center">
                      <Switch
                        checked={!!u.is_banned}
                        disabled={!canEditBanned}
                        onCheckedChange={(next) => {
                          if (next) {
                            openBan(u);
                            return;
                          }
                          if (!u.is_banned) return;

                          const ok = window.confirm(
                            `Unban ${u.email}? They will regain access to the site.`
                          );
                          if (!ok) return;

                          void doPatch(u, { is_banned: false, banned_reason: null });
                        }}
                        className="
                            bg-white/5
                            data-[state=checked]:bg-emerald-500/80
                            data-[state=unchecked]:bg-white/5
                            border border-white/10
                        "
                      />
                    </TableCell>

                    {/* actions */}
                    <TableCell className="align-top text-right">
                      <div className="flex justify-end gap-2">
                        {canMakeOwner ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-yellow-400 text-yellow-200 bg-white/5 hover:bg-white hover:text-black"
                            onClick={() => {
                              const ok = window.confirm(
                                `Make ${u.email} the OWNER? This is a high-permission action.`
                              );
                              if (!ok) return;
                              void doPatch(u, { is_owner: true });
                            }}
                          >
                            Make owner
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Ban dialog */}
      <AlertDialog open={banOpen} onOpenChange={setBanOpen}>
        <AlertDialogContent className="bg-black border border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Ban this user?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              You are about to ban{" "}
              <span className="font-mono text-xs">{banTarget?.email}</span>. Banned
              users cannot access the site. You can unban them later.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <label className="text-xs text-white/70">Reason (optional but recommended)</label>
            <Input
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              className="bg-white/5 border border-white/10 text-white placeholder:text-white/40"
              placeholder="e.g. spam, abuse, etc."
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="border border-white/15 bg-white/5 text-white hover:bg-white hover:text-black">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (!banTarget) return;
                void doPatch(banTarget, {
                  is_banned: true,
                  banned_reason: banReason.trim() || null,
                }).finally(() => setBanOpen(false));
              }}
            >
              Ban user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
