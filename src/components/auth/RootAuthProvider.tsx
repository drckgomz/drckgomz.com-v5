"use client";

import type { ReactNode } from "react";
import { BetterAuthSessionProvider } from "./BetterAuthSessionProvider";

/** Offline previews intentionally mount no auth client or provider SDK. */
export function RootAuthProvider({ children, offlineDesignMode = false }: {
  children: ReactNode;
  offlineDesignMode?: boolean;
}) {
  if (offlineDesignMode) return <>{children}</>;
  return <BetterAuthSessionProvider>{children}</BetterAuthSessionProvider>;
}
