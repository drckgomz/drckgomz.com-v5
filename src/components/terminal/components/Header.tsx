// src/components/terminal/components/Header.tsx
import Link from "next/link";

export default function Header() {
  return (
    <header className="fixed top-10 inset-x-0 z-40">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-center">
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
