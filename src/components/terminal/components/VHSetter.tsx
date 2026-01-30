// src/components/terminal/components/VHSetter.tsx
"use client";

import * as React from "react";

export default function VHSetter() {
  React.useEffect(() => {
    let raf = 0;

    const setVars = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const vv = window.visualViewport;

        const vh = vv?.height ?? window.innerHeight;
        const vw = vv?.width ?? window.innerWidth;

        // ✅ keyboard height approximation (works well on iOS Safari/Chrome)
        // innerHeight stays "layout viewport", vv.height shrinks when keyboard shows
        const keyboard = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;

        document.documentElement.style.setProperty("--app-vh", `${vh}px`);
        document.documentElement.style.setProperty("--app-vw", `${vw}px`);
        document.documentElement.style.setProperty("--kb", `${keyboard}px`);
      });
    };

    setVars();
    window.visualViewport?.addEventListener("resize", setVars);
    window.visualViewport?.addEventListener("scroll", setVars);
    window.addEventListener("resize", setVars);
    window.addEventListener("orientationchange", setVars);

    return () => {
      cancelAnimationFrame(raf);
      window.visualViewport?.removeEventListener("resize", setVars);
      window.visualViewport?.removeEventListener("scroll", setVars);
      window.removeEventListener("resize", setVars);
      window.removeEventListener("orientationchange", setVars);
    };
  }, []);

  return null;
}
