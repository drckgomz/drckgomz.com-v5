"use client";

import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { ClerkSessionProvider } from "./ClerkSessionProvider";
import { BetterAuthSessionProvider } from "./BetterAuthSessionProvider";

export default function ConfiguredAuthProvider({
  children,
  authProvider,
}: {
  children: ReactNode;
  authProvider: "clerk" | "better-auth";
}) {
  if (authProvider === "better-auth") return <BetterAuthSessionProvider>{children}</BetterAuthSessionProvider>;
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) throw new Error("Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  return (
    <ClerkProvider publishableKey={publishableKey} signInUrl="/sign-in" signUpUrl="/sign-up" afterSignInUrl="/blog" afterSignUpUrl="/blog">
      <ClerkSessionProvider>{children}</ClerkSessionProvider>
    </ClerkProvider>
  );
}
