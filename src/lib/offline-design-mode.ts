/** Explicit local-only mode for reviewing the public design without providers. */
export type OfflineDesignEnvironment = {
  NODE_ENV?: string;
  OFFLINE_DESIGN_MODE?: string;
};

export class OfflineDesignConfigurationError extends Error {
  constructor() {
    super("Offline design mode is valid only when explicitly enabled in development");
    this.name = "OfflineDesignConfigurationError";
  }
}

export function isOfflineDesignMode(env: OfflineDesignEnvironment): boolean {
  const selection = env.OFFLINE_DESIGN_MODE;
  if (selection === undefined || selection === "") return false;
  if (selection !== "1" || env.NODE_ENV !== "development") {
    throw new OfflineDesignConfigurationError();
  }
  return true;
}

/** Only explicitly public design-review routes are useful in this mode. */
export function isOfflineDesignRouteAllowed(pathname: string): boolean {
  return pathname === "/" || pathname === "/terminal" || pathname === "/blog" ||
    pathname === "/blog/offline-public-sample-one" || pathname === "/blog/offline-public-sample-two";
}
