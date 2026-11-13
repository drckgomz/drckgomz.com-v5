import Link from "next/link";

export const metadata = { title: "Contact • drckgomz" };

export default function ContactPage() {
  return (
    <main className="min-h-dvh bg-[#090a0b] px-6 py-10 text-white sm:px-10">
      <header className="mx-auto flex max-w-6xl justify-between">
        <Link href="/" className="font-display text-xl">drckgomz</Link>
        <Link href="/blog" className="text-sm text-white/70 underline underline-offset-4">Blog</Link>
      </header>
      <section className="mx-auto mt-[18vh] max-w-3xl">
        <p className="text-xs uppercase tracking-[0.2em] text-white/55">Contact</p>
        <h1 className="mt-4 font-display text-5xl sm:text-7xl">Get in touch.</h1>
        <p className="mt-6 max-w-xl leading-7 text-white/70">The contact address and form configuration have not been restored. This page will not send messages until a verified owner-managed destination is configured.</p>
      </section>
    </main>
  );
}
