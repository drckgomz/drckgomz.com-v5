// src/app/terminal/page.tsx
import Header from "@/components/terminal/components/Header";
import VideoBackground from "@/components/terminal/components/VideoBackground";
import TerminalShell from "@/components/terminal/components/TerminalShell";

export const revalidate = 0;

export default function TerminalPage() {
  return (
    <div className="relative h-dvh w-screen bg-black text-white overflow-x-hidden overflow-y-hidden flex flex-col">
      <div className="pb-10">
        <Header />
      </div>
      
      <VideoBackground />
      <TerminalShell />
    </div>
  );
}
