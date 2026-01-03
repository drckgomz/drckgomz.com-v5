// src/components/home/sections/hero/HeroSectionClient.tsx
"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

type HeroCrop = { x: number; y: number; zoom: number };

type HeroProps = {
  hero: {
    title?: string;
    description?: string;
    thumbnail_url?: string;
    crop: HeroCrop;
  };
};

export default function HeroSectionClient({ hero }: HeroProps) {
  const title = hero.title || "Hi, I’m Derick";
  const description = hero.description || "Creative, Developer, Tech Wiz";

  return (
    <motion.section
      id="hero"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="w-full min-h-screen flex items-start sm:items-center justify-center px-6 pt-24 sm:pt-0 text-white"
    >
      <Card className="max-w-3xl w-full bg-transparent border-0 shadow-xl">
        <CardContent className="flex flex-col items-center gap-6 py-10">
          {/* Avatar / hero image */}
          <Avatar className="h-56 w-56 sm:h-70 sm:w-70 shadow-lg overflow-hidden">
            {hero.thumbnail_url ? (
              <AvatarImage
                src={hero.thumbnail_url}
                alt={title}
                className="h-full w-full object-cover"
                style={{
                  objectPosition: `${hero.crop.x}% ${hero.crop.y}%`,
                  transform: `scale(${hero.crop.zoom * 1.1})`,
                  transformOrigin: "center center",
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "https://via.placeholder.com/192";
                }}
              />
            ) : (
              <AvatarFallback className="text-xs sm:text-sm text-white/70">
                Hero
              </AvatarFallback>
            )}
          </Avatar>

          {/* Text content */}
          <div className="text-center text-white bg-black/70 space-y-3">
            <h1 className="text-4xl sm:text-6xl font-extrabold mb-1 leading-tight">
              {title}
            </h1>

            <p className="text-lg sm:text-2xl font-light tracking-wide whitespace-pre-wrap text-white/85">
              {description}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.section>
  );
}
