// src/components/blog/Navbar.server.tsx
import { getUserProfile } from "@/lib/profile/getUserProfile";
import NavbarClientShell from "@/components/blog/NavbarClientShell";

export default async function NavbarServer() {
  const profile = await getUserProfile();
  return <NavbarClientShell profile={profile} />;
}
