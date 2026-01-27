// src/app/banned/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import DotsCanvas from "@/components/home/DotsCanvas";

export default function BannedPage() {
  const router = useRouter();
  const { signOut } = useClerk();

  const handleReturn = async () => {
    try {
      await signOut({ redirectUrl: "/terminal" });
    } catch (err) {
      console.error("[banned] signOut failed:", err);
      router.push("/terminal");
    }
  };

  return (
    <main className="relative min-h-dvh bg-black text-white overflow-hidden">
      {/* Dots background */}
      <div className="absolute inset-0">
        <DotsCanvas />
        {/* readability overlay */}
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Foreground content */}
      <div className="relative z-10 flex min-h-dvh items-center justify-center px-6">
        <div className="max-w-md text-center space-y-4 rounded-2xl border border-white/10 bg-black/70 backdrop-blur p-6">
          <h1 className="text-3xl font-bold">Access restricted</h1>

          <p className="text-white/70 text-sm">
            Your account has been banned. If you think this is a mistake, contact support.
          </p>

          <div className="pt-4">
            <Button
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white hover:text-black"
              onClick={handleReturn}
            >
              ← Return to Terminal
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
