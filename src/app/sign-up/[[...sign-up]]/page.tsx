// src/app/sign-up/[[...sign-up]]/page.tsx
"use client";

import { SignUp } from "@clerk/nextjs";
import DotsCanvas from "@/components/home/DotsCanvas";
import Header from "@/components/terminal/components/Header";

export default function SignUpPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-background">
      {/* Background */}
      <div aria-hidden className="absolute inset-0 z-0 pointer-events-none">
        <DotsCanvas />
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-background/60" />
      </div>

      {/* Foreground */}
      <div className="relative z-10">
        <div className="pointer-events-auto">
          <Header />
        </div>

        <div className="min-h-dvh grid place-items-center p-8">
          <div className="pt-8">
            <SignUp routing="hash" />
          </div>
        </div>
      </div>
    </main>
  );
}
