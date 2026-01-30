// src/components/terminal/components/VHSetter.tsx
"use client";

import * as React from "react";

export default function VHSetter() {
  React.useEffect(() => {
    let raf = 0;

    const setVars = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h = window.innerHeight;
        const w = window.innerWidth;
        document.documentElement.style.setProperty("--app-vh", `${h}px`);
        document.documentElement.style.setProperty("--app-vw", `${w}px`);
      });
    };

    setVars();
    window.addEventListener("resize", setVars);
    window.addEventListener("orientationchange", setVars);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", setVars);
      window.removeEventListener("orientationchange", setVars);
    };
  }, []);

  return null;
}
