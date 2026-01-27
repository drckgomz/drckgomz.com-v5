// src/app/sign-in/[[...sign-in]]/page.tsx
"use client";

import { SignIn } from "@clerk/nextjs";
import DotsCanvas from "@/components/home/DotsCanvas";
import Header from "@/components/terminal/components/Header";

export default function SignInPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-background">
      <div aria-hidden className="absolute inset-0 z-0 overflow-hidden">
        <DotsCanvas />
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-background/60" />
      </div>


      <div className="relative z-10">
        <div className="pointer-events-auto">
          <Header />
        </div>
        <div className="min-h-dvh grid place-items-center p-8">
          <SignIn routing="hash" />
        </div>
      </div>
    </main>
  );
}
