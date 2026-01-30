// src/components/terminal/components/Header.tsx
import Link from "next/link";

export default function Header() {
  return (
    <header className="relative z-40 w-full pt-8 sm:pt-10">
      <div className="mx-auto max-w-6xl px-4 flex items-center justify-center">
        <Link
          href="/"
          className="text-4xl sm:text-6xl font-bold text-white hover:opacity-80 tracking-wider"
        >
          DRCKGOMZ
        </Link>
      </div>
    </header>
  );
}
