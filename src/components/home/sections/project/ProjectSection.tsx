// frontend/src/features/home/components/sections/ProjectSection.tsx
"use client";
import { motion } from "framer-motion";
import HomeGrid from "@/components/home/sections/project/HomeGrid";

export default function ProjectSection() {
  return (
    <motion.section
      id="projects"
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7 }}
      viewport={{ once: true }}
      // NOTE: no justify-center; we let the grid start at the top and the page scroll.
      className="w-full min-h-screen flex flex-col items-center px-6 text-white py-24 gap-8"
    >
      <h2 className="text-3xl sm:text-5xl bg-black/70 font-bold text-center">Projects</h2>
      <div className="w-full max-w-6xl">
        <HomeGrid />
      </div>
    </motion.section>
  );
}
