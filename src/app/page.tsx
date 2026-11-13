// src/app/page.tsx
import NavBar from "@/components/home/NavBar";
import HeroSection from "@/components/home/sections/hero/HeroSection";
import OfflineHomePage from "@/components/home/OfflineHomePage";
import { isOfflineDesignMode } from "@/lib/offline-design-mode";

export default function HomePage() {
  if (isOfflineDesignMode({ NODE_ENV: process.env.NODE_ENV, OFFLINE_DESIGN_MODE: process.env.OFFLINE_DESIGN_MODE })) {
    return <OfflineHomePage />;
  }

  return (
    <div className="cinematic-home min-h-dvh w-full overflow-x-clip">
      <NavBar />
      <main id="main-content" tabIndex={-1} className="relative z-10">
        <HeroSection />
      </main>
    </div>
  );
}
