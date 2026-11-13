import NavBar from "@/components/home/NavBar";
import HeroSection from "@/components/home/sections/hero/HeroSection";

/** Same public composition as configured mode, with the CSS/poster fallback. */
export default function OfflineHomePage() {
  return (
    <div className="cinematic-home min-h-dvh w-full overflow-x-clip">
      <NavBar />
      <main id="main-content" className="relative z-10"><HeroSection /></main>
    </div>
  );
}
