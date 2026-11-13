import { readPublishedConfiguration } from "@/lib/site/configuration.server";
import Link from "next/link";

export const metadata = { title: "About • drckgomz" };

export default async function AboutPage() {
  const { settings } = await readPublishedConfiguration();
  return (
    <main className="min-h-dvh bg-[#090a0b] px-6 py-10 text-white sm:px-10">
      <header className="mx-auto flex max-w-6xl justify-between">
        <Link href="/" className="font-display text-xl">drckgomz</Link>
        <Link href="/contact" className="text-sm text-white/70 underline underline-offset-4">Contact</Link>
      </header>
      <section className="mx-auto mt-[18vh] max-w-3xl">
        <p className="text-xs uppercase tracking-[0.2em] text-white/55">About</p>
        <h1 className="mt-4 font-display text-5xl sm:text-7xl">{settings?.profile_name || "A little context."}</h1>
        <p className="mt-6 max-w-xl leading-7 text-white/70">{settings?.bio || "The CMS profile content has not been moved out of the legacy staging area yet, so it is intentionally not represented here."}</p>
        {settings?.social_links.length ? <nav aria-label="Social links" className="mt-6 flex flex-wrap gap-4">{settings.social_links.map(link => <a key={link.href} href={link.href} rel="noopener noreferrer" className="underline">{link.label}</a>)}</nav> : null}
      </section>
    </main>
  );
}
