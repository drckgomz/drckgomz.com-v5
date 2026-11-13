import { readPublishedConfiguration } from "@/lib/site/configuration.server";
import { publicHero } from "@/lib/site/public-config";
import HeroSectionClient from "./HeroSectionClient";

/**
 * Public-safe empty appearance defaults. Published appearance metadata is
 * supplied through the owner-managed Neon appearance repository when it is
 * available; no legacy provider is initialized by rendering the homepage.
 */
export default async function HeroSection() {
  const { homepage } = await readPublishedConfiguration();
  if (homepage?.enabled === false) return null;
  return <><HeroSectionClient hero={{ ...publicHero, title: homepage?.title ?? publicHero.title }} />{homepage?.description && <p className="relative z-10 mx-auto max-w-3xl p-6">{homepage.description}</p>}</>;
}
