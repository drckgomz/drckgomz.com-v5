// frontend/src/features/home/components/DotsCanvas.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils/utils";

type Props = { className?: string };

export default function DotsCanvas({ className }: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const ctxEl = canvasEl.getContext("2d");
    if (!ctxEl) return;

    const dotSpacing = 26;
    const dotRadius = 1.6;
    const amplitude = 5;
    const waveSpeed = 0.01;
    const wavelength = 110;

    let dots: { x: number; y: number }[] = [];
    let time = 0;
    let raf = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);

      canvasEl.width = Math.floor(w * dpr);
      canvasEl.height = Math.floor(h * dpr);
      canvasEl.style.width = `${w}px`;
      canvasEl.style.height = `${h}px`;

      ctxEl.setTransform(1, 0, 0, 1, 0, 0);
      ctxEl.scale(dpr, dpr);

      dots = [];
      const cols = Math.floor(w / dotSpacing);
      const rows = Math.floor(h / dotSpacing);
      for (let r = 0; r <= rows; r++) {
        for (let c = 0; c <= cols; c++) {
          dots.push({ x: c * dotSpacing, y: r * dotSpacing });
        }
      }
    };

    const render = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      ctxEl.clearRect(0, 0, w, h);

      ctxEl.fillStyle = "rgba(255,255,255,0.55)";
      for (const dot of dots) {
        const y = dot.y + Math.sin(dot.x / wavelength + time) * amplitude;
        ctxEl.beginPath();
        ctxEl.arc(dot.x, y, dotRadius, 0, Math.PI * 2);
        ctxEl.fill();
      }

      time += waveSpeed;
      raf = window.requestAnimationFrame(render);
    };

    resize();
    render();

    window.addEventListener("resize", resize, { passive: true });

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("fixed inset-0 z-0 pointer-events-none", className)}
    />
  );
}
