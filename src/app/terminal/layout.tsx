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
    <div
      className="fixed inset-0 bg-black text-white overflow-hidden"
      style={{
        height: "var(--app-vh, 100dvh)",
        // ✅ this is the key: when keyboard opens, we “make room” instead of iOS scrolling the page
        paddingBottom: "var(--kb, 0px)",
      }}
    >
      <VHSetter />

      {/* route content */}
      {children}

      {/* keep the *page* from scrolling; only internal terminal output should scroll */}
      <style>{`
        html, body { height: 100%; overflow: hidden; }
        body { overscroll-behavior: none; }
      `}</style>
    </div>
  );
}
