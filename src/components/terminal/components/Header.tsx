// src/components/terminal/components/Header.tsx
import Link from "next/link";

export default function Header() {
  return (
    <header className="fixed top-4 inset-x-0 z-40 pointer-events-none">
      <div className="mx-auto max-w-6xl px-4 flex justify-center">
        <Link
          href="/"
          className="pointer-events-auto text-3xl sm:text-6xl font-bold tracking-wider text-white/95 hover:opacity-80"
        >
          DRCKGOMZ
        </Link>
      </div>
    </header>
  );
}
