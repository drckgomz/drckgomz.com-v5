// src/app/settings/page.tsx
import "server-only";
import { redirect } from "next/navigation";
import Navbar from "@/components/blog/Navbar.server";
import BlogFooter from "@/components/blog/BlogFooter";
import AccountSettingsClient from "@/components/blog/AccountSettings.client";
import { getUserProfile } from "@/lib/profile/getUserProfile";

export default async function SettingsPage() {
  const profile = await getUserProfile();

  // If you want settings to be strictly protected:
  if (!profile) redirect("/sign-in?redirect_url=/settings");

  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      <Navbar />
      <main className="flex-grow mt-20 px-4">
        <AccountSettingsClient initialProfile={profile} />
      </main>
      <BlogFooter />
    </div>
  );
}
