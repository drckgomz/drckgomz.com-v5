// src/components/home/NavBar.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/#about", label: "About" },
  { href: "/#projects", label: "Projects" },
  { href: "/#contact", label: "Contact" },
  { href: "/terminal", label: "TERMINAL" },
] as const;

function NavItem({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="group relative inline-flex items-center text-sm md:text-base font-semibold tracking-wide text-white/60 transition-all duration-200 transform-gpu hover:text-white hover:-translate-y-0.5 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      <span>{children}</span>
      {/* animated underline */}
      <span className="pointer-events-none absolute -bottom-1 left-0 h-[2px] w-0 bg-white/80 transition-all duration-200 group-hover:w-full" />
    </Link>
  );
}

function Hamburger({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      onClick={onClick}
      className="md:hidden inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
      <span className="relative block h-4 w-5">
        <span
          className={[
            "absolute left-0 top-0 h-[2px] w-full bg-white transition-transform duration-200",
            open ? "translate-y-[7px] rotate-45" : "",
          ].join(" ")}
        />
        <span
          className={[
            "absolute left-0 top-[7px] h-[2px] w-full bg-white transition-opacity duration-200",
            open ? "opacity-0" : "opacity-100",
          ].join(" ")}
        />
        <span
          className={[
            "absolute left-0 bottom-0 h-[2px] w-full bg-white transition-transform duration-200",
            open ? "-translate-y-[7px] -rotate-45" : "",
          ].join(" ")}
        />
      </span>
    </button>
  );
}

export default function NavBar() {
  const [hidden, setHidden] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const lastY = useRef(0);
  const ticking = useRef(false);

  // Hide-on-scroll behavior (same as before)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;

      requestAnimationFrame(() => {
        const y = window.scrollY || 0;
        const isAtTop = y <= 8;
        setAtTop(isAtTop);

        if (isAtTop) {
          setHidden(false);
        } else {
          const goingDown = y > lastY.current + 2;
          const goingUp = y < lastY.current - 2;

          if (goingDown) setHidden(true);
          if (goingUp) setHidden(false);
        }

        lastY.current = y;
        ticking.current = false;
      });
    };

    lastY.current = window.scrollY || 0;
    setAtTop(lastY.current <= 8);

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  // Close on ESC
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const slideClass = hidden && !atTop ? "-translate-y-full" : "translate-y-0";

  return (
    <>
      {/* spacer so content doesn’t jump under fixed header */}
      <div className="h-16 md:h-14" aria-hidden="true" />

      <header
        role="banner"
        className={[
          "fixed inset-x-0 top-0 z-40",
          "bg-black/40 backdrop-blur-md border-b border-white/10",
          "transition-transform duration-300 ease-out will-change-transform",
          slideClass,
        ].join(" ")}
      >
        <nav
          className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:h-14 text-white"
          aria-label="Main"
        >
          {/* brand */}
          <Link
            href="/"
            className="text-2xl md:text-4xl font-extrabold tracking-wide hover:opacity-85"
            aria-label="Go to home"
            onClick={() => setMenuOpen(false)}
          >
            DRCKGOMZ
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-4 md:gap-6">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.href} href={item.href}>
                {item.label}
              </NavItem>
            ))}
          </div>

          {/* Mobile hamburger */}
          <Hamburger open={menuOpen} onClick={() => setMenuOpen((v) => !v)} />
        </nav>
      </header>

      {/* Mobile full-screen menu */}
      <div
        className={[
          "md:hidden fixed inset-0 z-50",
          "transition-opacity duration-200",
          menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
        aria-hidden={!menuOpen}
      >
        {/* backdrop */}
        <button
          type="button"
          className="absolute inset-0 bg-black/70"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />

        {/* panel */}
        <div
          className={[
            "absolute inset-0",
            "bg-black",
            "pt-6 px-6",
            "transition-transform duration-200",
            menuOpen ? "translate-y-0" : "-translate-y-2",
          ].join(" ")}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="text-2xl font-extrabold tracking-wide text-white hover:opacity-85"
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
                className="rounded-xl bg-transparent px-5 py-4 text-4xl font-semibold tracking-wide text-center text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
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
