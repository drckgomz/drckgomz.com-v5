// src/components/blog/NavbarClientShell.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/utils";
import type { UserProfile } from "@/lib/profile/types";
import UserAvatarClient from "@/components/blog/UserAvatar.client";

export default function NavbarClientShell({ profile }: { profile: UserProfile | null }) {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 40);
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isAdmin = profile?.role?.toLowerCase() === "admin";

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b border-white/10",
        "bg-black/80 backdrop-blur-md", // ✅ black navbar
        "transition-all duration-300",
        isScrolled ? "py-2 shadow-md" : "py-3 shadow-lg"
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => router.push("/blog")}
          className={cn(
            "select-none font-semibold tracking-tight lowercase",
            "text-lg sm:text-2xl md:text-3xl",
            "text-white hover:text-blue-400 transition-colors"
          )}
        >
          drckgomz
        </button>

        <nav className="flex items-center gap-3">
          {isAdmin && (
            <span className="hidden rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300 sm:inline">
              Admin
            </span>
          )}
          <UserAvatarClient profile={profile} />
        </nav>
      </div>
    </header>
  );
}
