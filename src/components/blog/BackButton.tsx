// src/components/blog/BackButton.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

export function BackButton({ fallbackHref = "/admin/posts" }: { fallbackHref?: string }) {
  const router = useRouter();

  const onBack = React.useCallback(() => {
    // If user landed directly here (no history), go to fallback
    if (typeof window !== "undefined" && window.history.length <= 1) {
      router.push(fallbackHref);
      return;
    }
    router.back();
  }, [router, fallbackHref]);

  return (
    <Button type="button" variant="secondary" onClick={onBack} className="gap-2 bg-transparent text-white/50 hover:bg-transparent hover:text-white/90">
      <ArrowLeft className="h-4 w-4" />
      Back
    </Button>
  );
}
