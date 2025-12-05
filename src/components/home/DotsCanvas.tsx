// frontend/src/features/home/components/DotsCanvas.tsx
"use client";
import * as React from "react";

type Props = React.HTMLAttributes<HTMLDivElement>; // accept className, style, etc.

export default function DotsCanvas({ className, ...rest }: Props) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Capture non-null refs so TS is happy in inner fns
    const containerEl: HTMLDivElement = container;
    const canvasEl: HTMLCanvasElement = canvas;
    const ctxEl: CanvasRenderingContext2D = ctx;

    // visuals
    const dotSpacing = 25;
    const dotRadius = 1.5;
    const amplitude = 5;
    const waveSpeed = 0.01;
    const wavelength = 100;

    let dots: { x: number; y: number }[] = [];
    let time = 0;
    let raf = 0;

    function resize() {
      const w = Math.max(1, containerEl.clientWidth);
      const h = Math.max(1, containerEl.clientHeight);
      const dpr = window.devicePixelRatio || 1;

      // match canvas device pixels to container CSS pixels
      canvasEl.width = Math.floor(w * dpr);
      canvasEl.height = Math.floor(h * dpr);
      canvasEl.style.width = `${w}px`;
      canvasEl.style.height = `${h}px`;

      // reset any existing transform then scale for DPR
      ctxEl.setTransform(1, 0, 0, 1, 0, 0);
      ctxEl.scale(dpr, dpr);

      // recompute the grid for the new size (in CSS px space)
      dots = [];
      const cols = Math.floor(w / dotSpacing);
      const rows = Math.floor(h / dotSpacing);
      for (let r = 0; r <= rows; r++) {
        for (let c = 0; c <= cols; c++) {
          dots.push({ x: c * dotSpacing, y: r * dotSpacing });
        }
      }
    }

    function render() {
      const w = containerEl.clientWidth;
      const h = containerEl.clientHeight;
      ctxEl.clearRect(0, 0, w, h);

      for (const dot of dots) {
        const y = dot.y + Math.sin(dot.x / wavelength + time) * amplitude;
        ctxEl.beginPath();
        ctxEl.arc(dot.x, y, dotRadius, 0, Math.PI * 2);
        ctxEl.fillStyle = "white";
        ctxEl.fill();
      }

      time += waveSpeed;
      raf = requestAnimationFrame(render);
    }

    // Resize on container changes (works inside responsive layouts)
    const ro = new ResizeObserver(() => resize());
    ro.observe(containerEl);

    resize();
    render();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-black ${className ?? ""}`}
      {...rest}
    >
      <canvas ref={canvasRef} className="absolute inset-0" aria-hidden />
    </div>
  );
}
