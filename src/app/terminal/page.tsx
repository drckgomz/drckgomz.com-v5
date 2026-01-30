// src/app/terminal/page.tsx
import Header from "@/components/terminal/components/Header";
import VideoBackground from "@/components/terminal/components/VideoBackground";
import TerminalShell from "@/components/terminal/components/TerminalShell";

export const revalidate = 0;

export default function TerminalPage() {
  return (
    <div className="relative w-screen h-svh overflow-hidden flex flex-col bg-black text-white">
      <Header />
      <VideoBackground />
      <TerminalShell />
    </div>
  );
}

