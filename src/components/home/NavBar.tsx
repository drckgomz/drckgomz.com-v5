// src/components/home/NavBar.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";

function NavItem({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative inline-flex items-center text-sm md:text-base font-semibold tracking-wide text-white/60 transition-all duration-200 transform-gpu hover:text-white hover:-translate-y-0.5 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      <span>{children}</span>
      {/* animated underline */}
      <span className="pointer-events-none absolute -bottom-1 left-0 h-[2px] w-0 bg-white/80 transition-all duration-200 group-hover:w-full" />
    </Link>
  );
}

export default function NavBar() {
  const [hidden, setHidden] = useState(false);
  const [atTop, setAtTop] = useState(true);

  const lastY = useRef(0);
  const ticking = useRef(false);

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
          >
            DRCKGOMZ
          </Link>

          {/* right side nav items */}
          <div className="flex items-center gap-4 md:gap-6">
            <NavItem href="/#about">About</NavItem>
            <NavItem href="/#projects">Projects</NavItem>
            <NavItem href="/#contact">Contact</NavItem>
            <NavItem href="/terminal">TERMINAL</NavItem>
          </div>
        </nav>
      </header>
    </>
  );
}
