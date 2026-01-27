// src/app/admin/users/useMembers.ts
"use client";

import * as React from "react";
import type { MeProfile, ProfileRow } from "./types";
import { useAuth } from "@clerk/nextjs";

function isJson(res: Response) {
  const c = res.headers.get("content-type") || "";
  return c.includes("application/json");
}

async function readErr(res: Response) {
  if (isJson(res)) {
    const j = await res.json().catch(() => ({}));
    return j?.error || `HTTP ${res.status}`;
  }
  const t = await res.text().catch(() => "");
  return t || `HTTP ${res.status}`;
}

export function useMembers() {
  const { isSignedIn, getToken } = useAuth();

  const [me, setMe] = React.useState<MeProfile | null>(null);
  const [users, setUsers] = React.useState<ProfileRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchMe = React.useCallback(async () => {
    if (!isSignedIn) {
      setMe(null);
      return;
    }

    const token = await getToken().catch(() => null);

    const res = await fetch("/api/admin/users/me", {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!res.ok) throw new Error(await readErr(res));
    const json = await res.json();
    setMe(json?.me ?? null);
  }, [isSignedIn, getToken]);

  const fetchUsers = React.useCallback(async () => {
    if (!isSignedIn) {
      setUsers([]);
      return;
    }

    const token = await getToken().catch(() => null);

    const res = await fetch("/api/admin/users", {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!res.ok) throw new Error(await readErr(res));
    const json = await res.json();

    const list: ProfileRow[] = Array.isArray(json?.users) ? json.users : [];
    list.sort((a, b) => a.email.localeCompare(b.email));
    setUsers(list);
  }, [isSignedIn, getToken]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchMe();
      await fetchUsers();
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [fetchMe, fetchUsers]);

  const patchUser = React.useCallback(
    async (id: string, body: Record<string, unknown>) => {
      const token = await getToken().catch(() => null);

      const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(await readErr(res));
    },
    [getToken]
  );

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { me, users, loading, error, refresh, patchUser };
}
