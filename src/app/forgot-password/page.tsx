import DotsCanvas from "@/components/home/DotsCanvas";
import Header from "@/components/terminal/components/Header";
import { ForgotPasswordForm } from "@/components/auth/BetterAuthRecoveryForms";
import { getBackendConfiguration } from "@/lib/backend-configuration";
import { isLocalPostgresIntegrationEnabled } from "@/lib/db/local-postgres-target";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  getBackendConfiguration();
  const localEmailEnabled = process.env.NODE_ENV === "development" && isLocalPostgresIntegrationEnabled(process.env);
  return <main className="relative min-h-dvh overflow-hidden bg-background text-white">
    <div aria-hidden className="pointer-events-none absolute inset-0"><DotsCanvas /><div className="absolute inset-0 bg-black/45" /></div>
    <div className="relative z-10"><Header /><div className="grid min-h-[75dvh] place-items-center p-4">{localEmailEnabled ? <ForgotPasswordForm /> : <p className="max-w-sm rounded-xl border border-white/10 bg-black/70 p-6 text-white">Password recovery is unavailable until an email delivery provider is configured.</p>}</div></div>
  </main>;
}
