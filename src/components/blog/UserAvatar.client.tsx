// src/components/blog/UserAvatar.client.tsx
"use client";

import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import type { UserProfile } from "@/lib/profile/types";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, Shield } from "lucide-react";

export default function UserAvatarClient({ profile }: { profile: UserProfile | null }) {
  const router = useRouter();
  const { signOut } = useClerk();

  if (!profile) {
    return (
      <Button size="sm" variant="outline" onClick={() => router.push("/sign-in")}>
        Sign in
      </Button>
    );
  }

  const initial =
    (profile.first_name?.[0] ||
      profile.username?.[0] ||
      profile.email?.[0] ||
      "U").toUpperCase();

  const isAdmin = profile.role?.toLowerCase() === "admin";
  const bg = profile.avatar_color || "#6b46c1";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full p-0 border border-white/15">
          <Avatar className="h-8 w-8 text-xs font-semibold text-white" style={{ backgroundColor: bg }}>
            <AvatarFallback className="text-[0.8rem] font-semibold text-white" style={{ backgroundColor: bg }}>
              {initial}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-60 bg-black text-white border border-white/10">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-xs text-white/60">Signed in as</span>
          <span className="truncate text-sm font-medium">{profile.email}</span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {isAdmin && (
          <DropdownMenuItem onClick={() => router.push("/admin")}>
            <Shield className="mr-2 h-4 w-4 text-amber-400" />
            Admin panel
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings className="mr-2 h-4 w-4" />
          Account settings
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => signOut({ redirectUrl: "/terminal" })}
          className="text-red-400 focus:text-red-400"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
