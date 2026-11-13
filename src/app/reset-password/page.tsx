import DotsCanvas from "@/components/home/DotsCanvas";
import Header from "@/components/terminal/components/Header";
import { ResetPasswordForm } from "@/components/auth/BetterAuthRecoveryForms";
import { getBackendConfiguration } from "@/lib/backend-configuration";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  getBackendConfiguration();
  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : "";
  return <main className="relative min-h-dvh overflow-hidden bg-background text-white">
    <div aria-hidden className="pointer-events-none absolute inset-0"><DotsCanvas /><div className="absolute inset-0 bg-black/45" /></div>
    <div className="relative z-10"><Header /><div className="grid min-h-[75dvh] place-items-center p-4"><ResetPasswordForm token={token} /></div></div>
  </main>;
}
