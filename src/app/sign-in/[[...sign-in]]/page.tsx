import DotsCanvas from "@/components/home/DotsCanvas";
import Header from "@/components/terminal/components/Header";
import { BetterAuthSignIn } from "@/components/auth/BetterAuthSignIn";
import { configuredSocialProviderIds } from "@/lib/db/config";
import { safeAuthRedirect } from "@/lib/auth/redirect";
import { getBackendConfiguration } from "@/lib/backend-configuration";
import { isLocalPostgresIntegrationEnabled } from "@/lib/db/local-postgres-target";

export default async function SignInPage({ searchParams }: {
  searchParams: Promise<{ redirect_url?: string | string[] }>;
}) {
  const query = await searchParams;
  const redirectTo = safeAuthRedirect(query.redirect_url);
  getBackendConfiguration();

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background">
      <div aria-hidden className="absolute inset-0 z-0 overflow-hidden">
        <DotsCanvas />
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-background/60" />
      </div>
      <div className="relative z-10">
        <div className="pointer-events-auto"><Header /></div>
        <div className="min-h-dvh grid place-items-center p-8">
          <BetterAuthSignIn redirectTo={redirectTo} providers={configuredSocialProviderIds(process.env)} localEmailEnabled={process.env.NODE_ENV === "development" && isLocalPostgresIntegrationEnabled(process.env)} />
        </div>
      </div>
    </main>
  );
}
