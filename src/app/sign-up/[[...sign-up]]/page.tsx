import DotsCanvas from "@/components/home/DotsCanvas";
import Header from "@/components/terminal/components/Header";
import { BetterAuthSignUp } from "@/components/auth/BetterAuthSignUp";
import { getBackendConfiguration } from "@/lib/backend-configuration";
import { isLocalPostgresIntegrationEnabled } from "@/lib/db/local-postgres-target";

export default function SignUpPage() {
  getBackendConfiguration();
  const registrationAvailable = process.env.NODE_ENV === "development" && isLocalPostgresIntegrationEnabled(process.env);
  return (
    <main className="relative min-h-dvh overflow-hidden bg-background">
      <div aria-hidden className="absolute inset-0 z-0 pointer-events-none">
        <DotsCanvas />
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-background/60" />
      </div>
      <div className="relative z-10">
        <div className="pointer-events-auto"><Header /></div>
        <div className="min-h-dvh grid place-items-center p-8">
          {registrationAvailable ? <BetterAuthSignUp /> : <section className="w-full max-w-sm space-y-3 rounded-xl border border-white/10 bg-black/70 p-6 text-white">
            <h1 className="text-xl font-semibold">Registration is unavailable</h1>
            <p className="text-sm text-white/70">Email delivery has not been configured for this environment.</p>
          </section>}
        </div>
      </div>
    </main>
  );
}
