// frontend/src/shared/lib/mediaController.ts
// Singleton registry to ensure only ONE hidden media plays at a time.
const registry = new Map<string, HTMLMediaElement>();

export function registerMedia(key: string, el: HTMLMediaElement) {
  registry.set(key, el);
}

export function unregisterMedia(key: string) {
  registry.delete(key);
}

export function playExclusive(key: string) {
  registry.forEach((m, k) => {
    if (k !== key) {
      try {
        m.pause();
        m.playbackRate = 1;
        // Optional: fire a custom event if you want UI to react
        m.dispatchEvent(new CustomEvent("paused-by-manager", { detail: { by: key } }));
      } catch {}
    }
  });
}
