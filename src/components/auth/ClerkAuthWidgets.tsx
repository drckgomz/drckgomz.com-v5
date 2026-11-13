"use client";

import { SignIn, SignUp } from "@clerk/nextjs";

export function ClerkSignInWidget() {
  return <SignIn routing="hash" />;
}

export function ClerkSignUpWidget() {
  return <SignUp routing="hash" />;
}
