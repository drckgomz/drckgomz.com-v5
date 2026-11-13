// src/app/layout.tsx
import PublicThemeBridge from "@/components/home/PublicThemeBridge";
import { readPublishedConfiguration } from "@/lib/site/configuration.server";
import type { Metadata } from "next";
import "./globals.css";
import { RootAuthProvider } from "@/components/auth/RootAuthProvider";
import { getBackendConfiguration } from "@/lib/backend-configuration";
import { isOfflineDesignMode } from "@/lib/offline-design-mode";

import { publicSiteMetadata } from "@/lib/site/public-config";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await readPublishedConfiguration();
  return settings ? { title: settings.title, description: settings.description } : publicSiteMetadata;
}

// ✅ Global viewport should be normal.
// Put terminal-specific viewport overrides in /terminal/layout.tsx instead.
export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const configuration = await readPublishedConfiguration();
  const offlineDesignMode = isOfflineDesignMode({ NODE_ENV: process.env.NODE_ENV, OFFLINE_DESIGN_MODE: process.env.OFFLINE_DESIGN_MODE });
  if (!offlineDesignMode) getBackendConfiguration();

  return (
    <html lang="en">
      <body data-theme-scope="public" data-theme="dark" className="min-h-dvh bg-black text-white overflow-x-hidden">
        {configuration.appearance && <PublicThemeBridge appearance={configuration.appearance} />}
        <RootAuthProvider offlineDesignMode={offlineDesignMode}>
          {children}
        </RootAuthProvider>
      </body>
    </html>
  );
}
