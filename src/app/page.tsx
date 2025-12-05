// src/app/page.tsx
import NavBar from "@/components/home/NavBar";
import DotsCanvas from "@/components/home/DotsCanvas";
import HeroSection from "@/components/home/sections/hero/HeroSection";
import AboutSection from "@/components/home/sections/about/AboutSection";
import SkillsSection from "@/components/home/sections/skills/SkillsSection";
import ProjectSection from "@/components/home/sections/project/ProjectSection";
import ExperienceSection from "@/components/home/sections/experience/ExperienceSection";
import ContactSection from "@/components/home/sections/contact/ContactSection";

export default function HomePage() {
  return (
    <div className="w-screen bg-transparent text-white overflow-x-hidden">
      {/* Nav */}
      <NavBar />

      {/* Background */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <DotsCanvas />
      </div>

      <main className="relative z-10 flex flex-col gap-32 pt-0">
        <HeroSection />
        <AboutSection />
        <ProjectSection />
        <ExperienceSection />
        <SkillsSection />
        <ContactSection />
      </main>
    </div>
  );
}
