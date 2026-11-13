"use client";

import { createContext, useContext, type ReactNode } from "react";

export type AuthSessionUser = { firstName?: string | null; username?: string | null; email?: string | null };
export type AuthSessionValue = {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: AuthSessionUser | null;
  getToken: () => Promise<string | null>;
  signOut: (options?: { redirectUrl?: string }) => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

export function AuthSessionProvider({ value, children }: { value: AuthSessionValue; children: ReactNode }) {
  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSessionValue {
  const value = useContext(AuthSessionContext);
  if (!value) throw new Error("AuthSessionProvider is missing");
  return value;
}

/** Optional for explicitly public preview components that can operate signed out. */
export function useOptionalAuthSession(): AuthSessionValue | null {
  return useContext(AuthSessionContext);
}
