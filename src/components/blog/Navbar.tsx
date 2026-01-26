// src/components/blog/Navbar.tsx
import "server-only";

import NavbarClientShell from "@/components/blog/NavbarClientShell";
import type { UserProfile } from "@/lib/profile/types";

export default function Navbar() {
  // IMPORTANT:
  // Do not call getUserProfile() here, or /blog becomes dynamic due to headers()/cookies.
  const profile: UserProfile | null = null;

  return <NavbarClientShell profile={profile} />;
}
