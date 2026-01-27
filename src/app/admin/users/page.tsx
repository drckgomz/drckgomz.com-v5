// src/app/admin/users/page.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { useMembers } from "@/app/admin/users/useMembers";
import { UsersTable } from "@/app/admin/users/UsersTable";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

export default function AdminUsersPage() {
  const router = useRouter();
  const { me, users, loading, error, refresh, patchUser } = useMembers();

  return (
    <main className="min-h-dvh bg-black text-white">
      <div className="pt-5 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          {/* Header row (same vibe as ManagePostsPage) */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold">Members & Whitelist</h1>
              <p className="mt-1 text-xs text-white/60">
                Manage roles, private access, bans, and owner privileges.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                className="bg-white/5 text-white border border-white/25 hover:bg-white hover:text-black"
                onClick={refresh}
              >
                Refresh
              </Button>

              <Button
                type="button"
                variant="secondary"
                className="bg-white/5 text-white border border-white/25 hover:bg-white hover:text-black"
                onClick={() => router.back()}
              >
                ← Back
              </Button>
            </div>
          </div>

          <Card className="rounded-2xl border border-white/10 bg-white/5">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold text-white">Users</CardTitle>
              <CardDescription className="text-xs text-white/60">
                {me ? (
                  <>
                    me: {(me.email || "").toLowerCase()}{" "}
                    {me.is_owner ? "· owner" : me.is_admin ? "· admin" : me.role ? `· ${me.role}` : ""}
                  </>
                ) : (
                  <>Sign in as an admin to view user management.</>
                )}
              </CardDescription>
            </CardHeader>

            <Separator className="bg-white/10" />

            <CardContent className="pt-4">
              {error ? (
                <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  error: {error}
                </div>
              ) : null}

              <UsersTable
                me={me}
                users={users}
                loading={loading}
                onPatch={async (id, body) => {
                  await patchUser(id, body);
                  await refresh();
                }}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
