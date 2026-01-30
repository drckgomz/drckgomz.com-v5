// src/app/terminal/layout.tsx
// src/app/terminal/layout.tsx
import type { Metadata } from "next";
import VHSetter from "@/components/terminal/components/VHSetter";

export const metadata: Metadata = { title: "Terminal • drckgomz" };

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden" style={{ height: "100svh" }}>
      <VHSetter />
      {children}

      <style>{`
        html, body { height: 100%; overflow: hidden; }
        body { overscroll-behavior: none; }
      `}</style>
    </div>
  );
}
