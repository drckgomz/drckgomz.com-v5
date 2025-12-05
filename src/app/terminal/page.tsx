// src/app/terminal/page.tsx
import Header from "@/components/terminal/components/Header";
import VideoBackground from "@/components/terminal/components/VideoBackground";
import TerminalShell from "@/components/terminal/components/TerminalShell";

export const revalidate = 0;

export default function TerminalPage() {
  return (
    <div className="relative min-h-dvh w-screen bg-black text-white overflow-x-hidden flex flex-col justify-between">
      <Header />
      <VideoBackground />
      <TerminalShell />
    </div>
  );
}
