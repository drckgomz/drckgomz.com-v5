"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import type { UserProfile } from "@/lib/profile/types";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/utils";

const COLOR_OPTIONS = [
  { value: "#4A90E2", label: "Blue", className: "bg-blue-500" },
  { value: "#E94E77", label: "Rose", className: "bg-rose-500" },
  { value: "#8E44AD", label: "Purple", className: "bg-purple-700" },
  { value: "#2ECC71", label: "Emerald", className: "bg-emerald-500" },
  { value: "#F39C12", label: "Amber", className: "bg-amber-500" },
];

type Props = {
  initialProfile: UserProfile; // server guaranteed
};

export default function AccountSettingsClient({ initialProfile }: Props) {
  const router = useRouter();

  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [username, setUsername] = React.useState(initialProfile.username ?? "");
  const [firstName, setFirstName] = React.useState(initialProfile.first_name ?? "");
  const [lastName, setLastName] = React.useState(initialProfile.last_name ?? "");
  const [avatarColor, setAvatarColor] = React.useState(initialProfile.avatar_color ?? "#4A90E2");

  const email = initialProfile.email ?? "";

  const initials =
    ((firstName?.[0] || "") + (lastName?.[0] || "")).toUpperCase() ||
    (username?.[0] || "U").toUpperCase();

  async function handleSaveAll() {
    setErr(null);
    try {
      setSaving(true);

      const body = {
        username: username.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        avatar_color: avatarColor.trim(),
      };

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Failed to save (HTTP ${res.status})`);

      // Optional: keep local cache in sync (your avatar reads server-side now, but this is harmless)
      try {
        localStorage.setItem("username", body.username);
        localStorage.setItem("avatarColor", body.avatar_color);
      } catch {}

      alert("Profile saved!");
      router.refresh(); // re-fetch server data
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center py-10">
      <Card className="w-full max-w-xl bg-gray-950/90 border border-white/10">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold text-white text-center">Account Settings</CardTitle>
          <CardDescription className="text-center text-xs text-white">
            Update your display name and avatar color. Email/sign-in are managed by Clerk.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {err && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {err}
            </div>
          )}

          {/* Avatar Preview */}
          <div className="flex items-center gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full text-lg text-white font-semibold border border-white/20 shadow-sm"
              style={{ backgroundColor: avatarColor }}
            >
              {initials}
            </div>
            <div className="text-xs text-white">
              <div className="font-medium text-sm">Profile avatar</div>
              <div>Based on your initials + color.</div>
            </div>
          </div>

          {/* Email (read-only) */}
          <div className="space-y-1">
            <Label htmlFor="emailInput">Email</Label>
            <Input
              id="emailInput"
              type="email"
              value={email}
              readOnly
              className="bg-gray-900 border-gray-700 text-white/80"
            />
          </div>

          {/* First / Last name */}
          <div className="grid grid-cols-1 text-white sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="bg-gray-900 border-gray-700"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="bg-gray-900 border-gray-700"
              />
            </div>
          </div>

          {/* Username */}
          <div className="space-y-1 text-white">
            <Label htmlFor="usernameInput">Display name</Label>
            <Input
              id="usernameInput"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-gray-900 border-gray-700"
            />
          </div>

          {/* Avatar color selection */}
          <div className="space-y-2 text-white">
            <Label>Avatar color</Label>
            <div className="flex flex-wrap items-center gap-3">
              {COLOR_OPTIONS.map((opt) => {
                const checked = avatarColor.toLowerCase() === opt.value.toLowerCase();
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAvatarColor(opt.value)}
                    className={cn(
                      "relative h-8 w-8 rounded-full border-2 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950",
                      opt.className,
                      checked ? "border-white scale-110" : "border-transparent hover:scale-105"
                    )}
                    aria-label={opt.label}
                  >
                    {checked && (
                      <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-white" />
                    )}
                  </button>
                );
              })}

              <div className="space-y-1">
                <Label htmlFor="avatarColorHex" className="text-xs">
                  Custom color (hex)
                </Label>
                <Input
                  id="avatarColorHex"
                  value={avatarColor}
                  onChange={(e) => setAvatarColor(e.target.value)}
                  className="bg-gray-900 border-gray-700 w-32 text-xs"
                  placeholder="#000000"
                />
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
          <div className="flex gap-2 justify-end w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              className="border-gray-600 text-black hover:bg-white/70 hover:text-white"
              onClick={() => router.back()}
            >
              ← Back
            </Button>
            <Button
              type="button"
              onClick={handleSaveAll}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
