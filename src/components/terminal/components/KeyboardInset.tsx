// src/components/terminal/components/KeyboardInset.tsx
"use client";
import * as React from "react";

export default function KeyboardInset() {
  React.useEffect(() => {
    let raf = 0;

    const setKb = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const vv = window.visualViewport;

        // fallback
        if (!vv) {
          document.documentElement.style.setProperty("--kb", "0px");
          return;
        }

        // keyboard height approximation
        const keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        document.documentElement.style.setProperty("--kb", `${keyboard}px`);
      });
    };

    setKb();
    window.visualViewport?.addEventListener("resize", setKb);
    window.visualViewport?.addEventListener("scroll", setKb);
    window.addEventListener("resize", setKb);
    window.addEventListener("orientationchange", setKb);

    return () => {
      cancelAnimationFrame(raf);
      window.visualViewport?.removeEventListener("resize", setKb);
      window.visualViewport?.removeEventListener("scroll", setKb);
      window.removeEventListener("resize", setKb);
      window.removeEventListener("orientationchange", setKb);
    };
  }, []);

  return null;
}
