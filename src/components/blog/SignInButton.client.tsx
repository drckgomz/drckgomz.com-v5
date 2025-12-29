// src/components/blog/SignInButton.client.tsx
"use client";

import { SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export default function SignInButtonClient({ redirectUrl }: { redirectUrl: string }) {
  return (
    <SignInButton forceRedirectUrl={redirectUrl}>
      <Button className="w-full">Sign in</Button>
    </SignInButton>
  );
}
