// src/app/sign-up/[[...sign-up]]/page.tsx
"use client";
import { SignUp } from "@clerk/nextjs";
import DotsCanvas from "@/components/home/DotsCanvas";
import Header from "@/components/terminal/components/Header";

export default function SignUpPage() {
  return (
    <main className="relative min-h-dvh grid place-items-center p-8 overflow-hidden bg-background">
      <Header />
      <div aria-hidden className="absolute inset-0 z-0 pointer-events-none">
        <DotsCanvas className="w-full h-full" />
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-background/60" />
      </div>

      <div className="relative pt-8 z-10">
        <SignUp routing="hash" />
      </div>
    </main>
  );
}
