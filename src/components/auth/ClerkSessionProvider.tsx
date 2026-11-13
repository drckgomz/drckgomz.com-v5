"use client";

import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { AuthSessionProvider } from "./AuthSessionContext";

export function ClerkSessionProvider({ children }: { children: ReactNode }) {
  const { isLoaded: authLoaded, isSignedIn, getToken } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const clerk = useClerk();
  return (
    <AuthSessionProvider value={{
      isLoaded: authLoaded && userLoaded,
      isSignedIn: Boolean(isSignedIn),
      user: user ? {
        firstName: user.firstName,
        username: user.username,
        email: user.primaryEmailAddress?.emailAddress ?? null,
      } : null,
      getToken: () => getToken().catch(() => null),
      signOut: async (options) => { await clerk.signOut(options); },
    }}>
      {children}
    </AuthSessionProvider>
  );
}
