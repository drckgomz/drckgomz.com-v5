// frontend/src/features/blog/components/IdleLogoutGuard.tsx
"use client";

import * as React from "react";
import { useAuthSession } from "@/components/auth/AuthSessionContext";
import { usePathname } from "next/navigation";
import { startInactivityLogout } from "@/lib/utils/inactivityWatcher";

export default function IdleLogoutGuard({ minutes = 5 }: { minutes?: number }) {
  const { isLoaded, isSignedIn, signOut } = useAuthSession();
  const pathname = usePathname();

  React.useEffect(() => {
    // Don’t arm until Clerk has fully loaded and the user is actually signed in
    if (!isLoaded || !isSignedIn) return;

    const stop = startInactivityLogout(
      async () => {
        // You can also clear any app caches here if needed
        await signOut({ redirectUrl: `/auth?to=${encodeURIComponent(pathname || "/")}` });
      },
      {
        timeoutMinutes: minutes,
        armDelayMs: 8000, // extra safety during post-login render
        redirectTo: `/auth?to=${encodeURIComponent(pathname || "/")}`,
      }
    );

    return () => stop();
  }, [isLoaded, isSignedIn, minutes, pathname, signOut]);

  return null;
}
