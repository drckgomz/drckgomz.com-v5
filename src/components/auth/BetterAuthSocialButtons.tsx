"use client";

import { useState } from "react";
import { createAuthClient } from "better-auth/react";
import { Button } from "@/components/ui/button";

const authClient = createAuthClient({ basePath: "/api/auth" });
export type SocialProviderId = "apple" | "google";

const providerNames: Record<SocialProviderId, string> = { apple: "Apple", google: "Google" };

export function BetterAuthSocialButtons({
  providers,
  callbackURL = "/blog",
}: {
  providers: SocialProviderId[];
  callbackURL?: string;
}) {
  const [pendingProvider, setPendingProvider] = useState<SocialProviderId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startSignIn(provider: SocialProviderId) {
    if (pendingProvider) return;
    setPendingProvider(provider);
    setError(null);
    try {
      const result = await authClient.signIn.social({ provider, callbackURL });
      if (result.error) setError("Sign-in is temporarily unavailable. Try again shortly.");
    } catch {
      setError("Sign-in is temporarily unavailable. Try again shortly.");
    } finally {
      setPendingProvider(null);
    }
  }

  return (
    <div className="w-full space-y-3">
      {providers.map((provider) => (
        <Button
          key={provider}
          type="button"
          className="w-full"
          disabled={pendingProvider !== null}
          aria-busy={pendingProvider === provider}
          onClick={() => void startSignIn(provider)}
        >
          {pendingProvider === provider ? "Redirecting…" : `Continue with ${providerNames[provider]}`}
        </Button>
      ))}
      {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
