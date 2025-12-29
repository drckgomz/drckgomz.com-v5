// frontend/src/shared/utils/inactivityWatcher.ts
type StopFn = () => void;

type Options = {
  timeoutMinutes?: number;   // default 15
  armDelayMs?: number;       // wait before arming (default 8000ms)
  redirectTo?: string;       // optional hint, unused here (you redirect in caller)
};

export function startInactivityLogout(
  onTimeout: () => void | Promise<void>,
  opts: Options = {}
): StopFn {
  if (typeof window === "undefined") return () => {};

  const timeoutMs = Math.max(1, (opts.timeoutMinutes ?? 15)) * 60_000;
  const armDelayMs = opts.armDelayMs ?? 8_000; // give Clerk time to settle

  let lastActivity = Date.now();
  let armed = false;
  let tickId: number | undefined;

  const markActivity = () => {
    lastActivity = Date.now();
  };

  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      // when tab becomes visible, consider that activity
      markActivity();
    }
  };

  // Arm after a grace period so we don't fire during login hydration
  const armTimer = window.setTimeout(() => {
    armed = true;
    markActivity();
  }, armDelayMs);

  // Use an interval (handles sleeping tabs better than long setTimeout)
  tickId = window.setInterval(async () => {
    if (!armed) return;
    // Don’t time out while the page is hidden; wait until visible again
    if (document.visibilityState !== "visible") return;

    const idleFor = Date.now() - lastActivity;
    if (idleFor >= timeoutMs) {
      // disarm before firing to avoid double-calls
      cleanup();
      try {
        await onTimeout();
      } catch (e) {
        console.error("[IDLE] onTimeout error", e);
      }
    }
  }, 5_000) as unknown as number;

  // Listen to common user interactions
  const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;
  events.forEach((ev) => window.addEventListener(ev, markActivity, { passive: true }));
  document.addEventListener("visibilitychange", onVisibility);

  const cleanup = () => {
    if (armTimer) window.clearTimeout(armTimer);
    if (tickId) window.clearInterval(tickId);
    events.forEach((ev) => window.removeEventListener(ev, markActivity));
    document.removeEventListener("visibilitychange", onVisibility);
  };

  return cleanup;
}
