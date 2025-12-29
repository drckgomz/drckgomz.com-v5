// frontend/src/components/blog/Navbar.tsx
import UserAvatarServer from "@/components/blog/UserAvatar.server";
import NavbarClientShell from "@/components/blog/NavbarClientShell";

export default function Navbar() {
  return (
    <NavbarClientShell>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <a
          href="/blog"
          className="select-none font-semibold tracking-tight lowercase text-lg sm:text-2xl md:text-3xl text-white hover:text-blue-400 transition-colors"
        >
          drckgomz
        </a>

        <nav className="flex items-center gap-3">
          <UserAvatarServer />
        </nav>
      </div>
    </NavbarClientShell>
  );
}
