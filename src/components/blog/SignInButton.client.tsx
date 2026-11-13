// src/components/blog/SignInButton.client.tsx
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SignInButtonClient({ redirectUrl }: { redirectUrl: string }) {
  return (
    <Button asChild className="w-full">
      <Link href={`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`}>Sign in</Link>
    </Button>
  );
}
