// frontend/src/features/blog/components/DebugAuthBadge.tsx
"use client";
import { useAuth } from "@clerk/nextjs";

export default function DebugAuthBadge() {
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth();
  return <pre className="text-xs text-white/70 p-2 bg-white/5 rounded-md pt-20">
    {JSON.stringify({ client: { isLoaded, isSignedIn, userId, sessionId } }, null, 2)}
  </pre>;
}
