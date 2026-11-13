import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getBetterAuth } from "@/lib/auth/better-auth";
import { getUserProfile } from "@/lib/profile/getUserProfile";
import { BetterAuthAccount } from "@/components/auth/BetterAuthAccount";
import AccountSettingsClient from "@/components/blog/AccountSettings.client";
import Navbar from "@/components/blog/Navbar";
import BlogFooter from "@/components/blog/BlogFooter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AccountPage() {
  const profile = await getUserProfile();
  if (!profile) redirect("/sign-in?redirect_url=/account");
  const session = await getBetterAuth().api.getSession({ headers: await headers() });
  if (!session?.user?.id || session.user.id !== profile.id) redirect("/sign-in?redirect_url=/account");
  return <div className="flex min-h-dvh flex-col bg-black text-white">
    <Navbar />
    <main className="grow mt-20 space-y-8 px-4 py-8">
      <AccountSettingsClient initialProfile={profile} />
      <BetterAuthAccount initialName={session.user.name} email={session.user.email} verified={session.user.emailVerified} showNameEditor={false} />
    </main>
    <BlogFooter />
  </div>;
}
