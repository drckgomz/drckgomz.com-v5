// src/app/(protected)/blog/layout.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { ReactNode } from "react";
import Navbar from "@/components/blog/Navbar";
import BlogFooter from "@/components/blog/BlogFooter";
import { requireUserProfile } from "@/lib/profile/requireUser";

export default async function BlogLayout({ children }: { children: ReactNode }) {
  await requireUserProfile(); // redirects banned -> /banned, not signed in -> /sign-in

  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <Navbar />
      <main className="grow">{children}</main>
      <BlogFooter />
    </div>
  );
}
