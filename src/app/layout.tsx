// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "drckgomz",
  description: "Derick's portfolio + blog + terminal",
};

// ✅ Global viewport should be normal.
// Put terminal-specific viewport overrides in /terminal/layout.tsx instead.
export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) throw new Error("Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/blog"
      afterSignUpUrl="/blog"
    >
      <html lang="en">
        <body className="min-h-dvh bg-black text-white overflow-x-hidden">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
