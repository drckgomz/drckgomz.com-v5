// frontend/src/features/blog/components/DebugAuthBadge.tsx
"use client";
import { useAuthSession } from "@/components/auth/AuthSessionContext";

export default function DebugAuthBadge() {
  const { isLoaded, isSignedIn, user } = useAuthSession();
  return <pre className="text-xs text-white/70 p-2 bg-white/5 rounded-md pt-20">
    {JSON.stringify({ client: { isLoaded, isSignedIn, hasUser: Boolean(user) } }, null, 2)}
  </pre>;
}
