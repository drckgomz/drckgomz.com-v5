"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { createAuthClient } from "better-auth/react";
import { AuthSessionProvider } from "./AuthSessionContext";

const authClient = createAuthClient({ basePath: "/api/auth" });

export function BetterAuthSessionProvider({ children }: { children: ReactNode }) {
  const { data, isPending } = authClient.useSession();
  const sessionUser = data?.user;
  const sessionId = sessionUser?.id;
  const sessionName = sessionUser?.name;
  const sessionEmail = sessionUser?.email;
  const getToken = useCallback(async () => null, []);
  const signOut = useCallback(async (options?: { redirectUrl?: string }) => {
    await authClient.signOut();
    if (options?.redirectUrl) window.location.assign(options.redirectUrl);
  }, []);
  const value = useMemo(() => ({
    isLoaded: !isPending,
    isSignedIn: Boolean(sessionId),
    user: sessionId ? { firstName: sessionName, username: sessionName, email: sessionEmail } : null,
    getToken,
    signOut,
  }), [isPending, sessionId, sessionName, sessionEmail, getToken, signOut]);
  return (
    <AuthSessionProvider value={value}>
      {children}
    </AuthSessionProvider>
  );
}
