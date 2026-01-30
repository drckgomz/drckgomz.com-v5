// src/app/terminal/layout.tsx
import type { Metadata } from "next";
import KeyboardInset from "@/components/terminal/components/KeyboardInset";

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
      className="bg-black text-white overflow-hidden"
      style={{
        height: "100svh", // stable viewport height
      }}
    >
      <KeyboardInset />
      {children}
    </div>
  );
}
