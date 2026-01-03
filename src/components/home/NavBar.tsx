// src/components/home/NavBar.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/#about", label: "About" },
  { href: "/#projects", label: "Projects" },
  { href: "/#contact", label: "Contact" },
  { href: "/terminal", label: "TERMINAL" },
] as const;

function NavItem({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group relative inline-flex items-center text-sm md:text-base font-semibold tracking-wide text-white/70 transition-all duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
    >
      <span>{children}</span>
      <span className="pointer-events-none absolute -bottom-1 left-0 h-0.5 w-0 bg-white/80 transition-all duration-200 group-hover:w-full" />
    </Link>
  );
}

function Hamburger({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={open ? "Close menu" : "Open menu"}
      {...{ "aria-expanded": open ? "true" : "false" }}
      aria-controls="mobile-nav"
      onClick={onClick}
      className="md:hidden inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
    >
      <span className="relative block h-4 w-5">
        <span
          className={`absolute left-0 top-0 h-0.5 w-full bg-white transition-transform ${
            open ? "translate-y-[7px] rotate-45" : ""
          }`}
        />
        <span
          className={`absolute left-0 top-[7px] h-0.5 w-full bg-white transition-opacity ${
            open ? "opacity-0" : "opacity-100"
          }`}
        />
        <span
          className={`absolute left-0 bottom-0 h-0.5 w-full bg-white transition-transform ${
            open ? "-translate-y-[7px] -rotate-45" : ""
          }`}
        />
      </span>
    </button>
  );
}

export default function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [atTop, setAtTop] = useState(true);

  // ✅ show ONLY at the very top
  useEffect(() => {
    const threshold = 8;

    const onScroll = () => {
      const y = window.scrollY || 0;
      const nowAtTop = y <= threshold;
      setAtTop(nowAtTop);

      // If user leaves the top, hide menu too
      if (!nowAtTop) setMenuOpen(false);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // lock scroll when mobile menu open
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const headerVisibleClass = atTop ? "translate-y-0" : "-translate-y-full";

  return (
    <>
      {/* spacer so content doesn’t jump under fixed header */}
      <div className="h-16 md:h-14" aria-hidden="true" />

      <header
        className={[
          "fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-black/70 backdrop-blur-md",
          "transition-transform duration-300 ease-out will-change-transform",
          headerVisibleClass,
        ].join(" ")}
        role="banner"
      >
        <nav
          className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:h-14 text-white"
          aria-label="Main"
        >
          {/* Brand */}
          <Link
            href="/"
            className="text-2xl md:text-4xl font-extrabold tracking-wide hover:opacity-85"
            onClick={() => setMenuOpen(false)}
          >
            DRCKGOMZ
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.href} href={item.href}>
                {item.label}
              </NavItem>
            ))}
          </div>

          {/* Mobile hamburger (only usable at top) */}
          <Hamburger open={menuOpen} onClick={() => setMenuOpen(!menuOpen)} />
        </nav>
      </header>

      {/* Mobile full-screen menu */}
      <div
        id="mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
        className={`md:hidden fixed inset-0 z-50 transition-opacity ${
          menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          className="absolute inset-0 bg-black/80"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />

        <div className="absolute inset-0 bg-black px-6 pt-6">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="text-2xl font-extrabold tracking-wide text-white"
              onClick={() => setMenuOpen(false)}
            >
              DRCKGOMZ
            </Link>
            <Hamburger open={menuOpen} onClick={() => setMenuOpen(false)} />
          </div>

          <div className="mt-10 flex flex-col gap-5">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-xl bg-transparent px-5 py-4 text-4xl font-semibold tracking-wide text-center text-white hover:bg-white/10"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
