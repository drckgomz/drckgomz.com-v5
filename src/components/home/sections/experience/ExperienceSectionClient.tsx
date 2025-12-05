// src/components/home/sections/experience/ExperienceSectionClient.tsx
"use client";

import { motion } from "framer-motion";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

type Props = {
  title: string;
  description: string;
};

export default function ExperienceSectionClient({ title, description }: Props) {
  const hasText = description.trim().length > 0;

  return (
    <motion.section
      id="experience"
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7 }}
      viewport={{ once: true }}
      className="w-full min-h-screen flex flex-col items-center justify-center px-6 py-16 text-white"
    >
      <Card className="max-w-4xl w-full bg-transparent border-0 shadow-xl">
        <CardHeader className="flex flex-col items-center gap-3 text-center">
          <CardTitle className="text-3xl text-white sm:text-5xl bg-black/70 font-bold text-shadow-lg">
            {title}
          </CardTitle>
        </CardHeader>

        <CardContent className="pb-8">
          {hasText ? (
            <div className="text-base sm:text-lg leading-relaxed font-semibold bg-black/70 text-white whitespace-pre-wrap">
              {description}
            </div>
          ) : (
            <p className="text-center text-white/50 text-sm sm:text-base">
              No experience content yet.
            </p>
          )}
        </CardContent>
      </Card>
    </motion.section>
  );
}
