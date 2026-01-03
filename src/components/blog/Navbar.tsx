// src/components/blog/Navbar.tsx (SERVER)
import "server-only";

import { getUserProfile } from "@/lib/profile/getUserProfile";
import NavbarClientShell from "@/components/blog/NavbarClientShell";

export default async function Navbar() {
  const profile = await getUserProfile();
  return <NavbarClientShell profile={profile} />;
}
