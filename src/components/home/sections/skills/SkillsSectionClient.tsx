// src/components/home/sections/skills/SkillsSectionClient.tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ResumeModal from "@/components/home/sections/resume/ResumeModal";

type Props = {
  title: string;
  description: string;
};

export default function SkillsSectionClient({ title, description }: Props) {
  const hasText = description.trim().length > 0;
  const [openResume, setOpenResume] = useState(false);

  return (
    <>
      <motion.section
        id="skills"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        viewport={{ once: true }}
        className="w-full min-h-screen flex flex-col items-center justify-center px-6 py-16 text-white"
      >
        <Card className="max-w-4xl w-full bg-transparent border-0 shadow-xl">
          <CardHeader className="flex flex-col items-center gap-3 text-center">
            <CardTitle className="text-3xl text-white sm:text-5xl bg-black/70 font-bold text-shadow-lg">
              {title || "Skills"}
            </CardTitle>
          </CardHeader>

          <CardContent className="pb-8">
            {hasText ? (
              <div className="text-base sm:text-lg leading-relaxed font-semibold bg-black/70 text-white whitespace-pre-wrap">
                {description}
              </div>
            ) : (
              <p className="text-sm sm:text-base text-white/50 text-center">
                No skills content yet.
              </p>
            )}

            {/* Resume button under skills content */}
            <div className="mt-6 flex justify-center">
              <Button
                type="button"
                variant="outline"
                className="border-white/40 text-black hover:bg-white/10 hover:text-white"
                onClick={() => setOpenResume(true)}
              >
                View Resume
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.section>

      {/* Resume modal tied to this section */}
      <ResumeModal
        isOpen={openResume}
        onClose={() => setOpenResume(false)}
      />
    </>
  );
}
