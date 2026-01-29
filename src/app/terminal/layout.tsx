// src/app/terminal/layout.tsx
import type { Metadata } from "next";
import VHSetter from "@/components/terminal/components/VHSetter";

export const metadata: Metadata = {
  title: "Terminal • drckgomz",
};

// ✅ Only terminal gets this (prevents iOS focus-zoom)
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="bg-black text-white overflow-hidden"
      style={{
        // ✅ The whole terminal route uses the "real" viewport height
        height: "var(--app-vh, 100dvh)",
        minHeight: "var(--app-vh, 100dvh)",
      }}
    >
      <VHSetter />
      {children}
    </div>
  );
}
