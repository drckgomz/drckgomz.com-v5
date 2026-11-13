// src/app/(protected)/blog/layout.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { ReactNode } from "react";
import Navbar from "@/components/blog/Navbar";
import BlogFooter from "@/components/blog/BlogFooter";
import { isOfflineDesignMode } from "@/lib/offline-design-mode";

export default async function BlogLayout({ children }: { children: ReactNode }) {
  const offlinePreview = isOfflineDesignMode({ NODE_ENV: process.env.NODE_ENV, OFFLINE_DESIGN_MODE: process.env.OFFLINE_DESIGN_MODE });

  return (
    <div data-theme-scope="blog" data-theme="dark" className="flex min-h-screen flex-col bg-black text-white">
      <Navbar offlinePreview={offlinePreview} />
      <main className="grow">{children}</main>
      <BlogFooter offlinePreview={offlinePreview} />
    </div>
  );
}
