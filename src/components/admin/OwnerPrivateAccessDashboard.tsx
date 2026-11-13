"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PrivateAudienceUser } from "@/lib/auth/private-audience-api";

const PAGE_SIZE = 50;

export function OwnerPrivateAccessDashboard() {
  const [users, setUsers] = useState<PrivateAudienceUser[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async (nextOffset: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/private-audience?limit=${PAGE_SIZE}&offset=${nextOffset}`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body || !Array.isArray(body.users) || typeof body.total !== "number") {
        throw new Error(body?.error || "Unable to load registered users.");
      }
      setUsers(body.users as PrivateAudienceUser[]);
      setTotal(body.total);
      setOffset(nextOffset);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load registered users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(() => refresh(0)); }, [refresh]);

  async function changeGrant(user: PrivateAudienceUser) {
    if (pendingId) return;
    setPendingId(user.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/private-audience", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, grant: !user.canViewPrivate }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Unable to update private access.");
      setNotice(body?.changed ? `Private journal access ${user.canViewPrivate ? "revoked from" : "approved for"} ${user.email}.` : "No change was needed.");
      await refresh(offset);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update private access.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <main className="min-h-[70dvh] bg-black px-4 py-8 text-white sm:px-6">
      <section className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Private journal access</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/65">Approve or revoke access for registered accounts. New accounts start with public content only.</p>
          </div>
          <Button type="button" variant="secondary" onClick={() => void refresh(offset)} disabled={loading}>Refresh</Button>
        </header>

        {error ? <p role="alert" className="rounded-lg border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-200">{error}</p> : null}
        {notice ? <p role="status" className="rounded-lg border border-emerald-400/30 bg-emerald-950/30 p-3 text-sm text-emerald-200">{notice}</p> : null}

        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-white/60">
              <tr><th scope="col" className="px-4 py-3">Account</th><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-4 py-3">Private journal</th><th scope="col" className="px-4 py-3">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? <tr><td colSpan={4} className="px-4 py-8 text-center text-white/60">Loading accounts…</td></tr> : null}
              {!loading && !error && users.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-white/60">No registered accounts on this page.</td></tr> : null}
              {!loading && !error && users.map((user) => {
                const blocked = !user.provisioned || !user.emailVerified || !user.enabled || user.banned;
                const canChange = !user.hasAdminAccess && pendingId === null && (!blocked || user.canViewPrivate);
                return (
                  <tr key={user.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{user.name || user.username}</div>
                      <div className="break-all text-xs text-white/60">{user.email}</div>
                      <div className="mt-1 text-[11px] text-white/40">Joined {new Date(user.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="px-4 py-3">{!user.provisioned ? "Profile pending" : !user.emailVerified ? "Unverified" : user.isOwner ? "Owner" : user.banned ? "Banned" : user.enabled ? "Active" : "Disabled"}</td>
                    <td className="px-4 py-3">{user.hasAdminAccess ? "Administrative access" : user.canViewPrivate ? "Approved" : "Public only"}</td>
                    <td className="px-4 py-3">
                      <Button
                        type="button"
                        size="sm"
                        variant={user.canViewPrivate ? "secondary" : "default"}
                        disabled={!canChange}
                        aria-label={user.hasAdminAccess ? `Administrative private access for ${user.email}` : `${user.canViewPrivate ? "Revoke" : "Approve"} private journal access for ${user.email}`}
                        onClick={() => void changeGrant(user)}
                      >
                        {pendingId === user.id ? "Saving…" : user.hasAdminAccess ? "Admin access" : user.canViewPrivate ? "Revoke" : blocked ? "Blocked" : "Approve"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <nav aria-label="Account pages" className="flex items-center justify-between text-sm">
          <span className="text-white/60">{error ? "Account count unavailable" : total ? `${offset + 1}–${Math.min(offset + users.length, total)} of ${total}` : "0 accounts"}</span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={loading || offset === 0} onClick={() => void refresh(Math.max(0, offset - PAGE_SIZE))}>Previous</Button>
            <Button type="button" variant="secondary" disabled={loading || offset + PAGE_SIZE >= total} onClick={() => void refresh(offset + PAGE_SIZE)}>Next</Button>
          </div>
        </nav>
      </section>
    </main>
  );
}
