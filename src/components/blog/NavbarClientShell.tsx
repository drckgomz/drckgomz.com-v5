// src/components/blog/NavbarClientShell.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/utils";
import type { UserProfile } from "@/lib/profile/types";
import UserAvatarClient from "@/components/blog/UserAvatar.client";
import { Button } from "@/components/ui/button";

type Props = { profile: UserProfile | null; offlinePreview?: boolean };

export default function NavbarClientShell({ profile: initialProfile, offlinePreview = false }: Props) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 40);
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fetch profile only if we weren't given one (static navbar case)
  useEffect(() => {
    if (offlinePreview) return;
    if (profile) return;

    const ac = new AbortController();

    (async () => {
      try {
        const res = await fetch("/api/profile", {
          method: "GET",
          cache: "no-store",
          signal: ac.signal,
        });

        if (!res.ok) {
          // 401/403/etc => treat as signed out
          setProfile(null);
          return;
        }

        const json = await res.json().catch(() => null);

        // Support either { profile: ... } or direct profile object
        const nextProfile = (json?.profile ?? json) as UserProfile | null;
        setProfile(nextProfile ?? null);
      } catch (e) {
        // Abort is fine; any other error => treat as signed out
        if (e instanceof Error && e.name === "AbortError") return;
        setProfile(null);
      }
    })();

    return () => ac.abort();
  }, [profile, offlinePreview]);

  const isAdmin = useMemo(
    () => profile?.role?.toLowerCase() === "admin",
    [profile?.role]
  );

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b border-white/10",
        "bg-black/80 backdrop-blur-md",
        "transition-all duration-300",
        isScrolled ? "py-2 shadow-md" : "py-3 shadow-lg"
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="drckgomz home"
          className={cn(
            "select-none font-semibold tracking-tight lowercase",
            "shrink-0 text-lg sm:text-2xl md:text-3xl",
            "text-white hover:text-blue-400 transition-colors"
          )}
        >
          drckgomz
        </Link>

        <nav aria-label="Blog navigation" className="flex items-center gap-3 sm:gap-5">
          <Link
            href="/"
            className="rounded-sm text-sm font-medium text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-4 focus-visible:ring-offset-black"
          >
            Home
          </Link>
          {isAdmin && (
            <span className="hidden rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300 sm:inline">
              Admin
            </span>
          )}
          {offlinePreview ? (
            <Button size="sm" variant="outline" disabled aria-disabled="true" title="Sign-in is unavailable in offline preview">Sign in</Button>
          ) : <UserAvatarClient profile={profile} />}
        </nav>
      </div>
    </header>
  );
}
