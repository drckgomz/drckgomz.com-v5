// src/app/admin/layout.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { ReactNode } from "react";
import Navbar from "@/components/blog/Navbar";
import BlogFooter from "@/components/blog/BlogFooter";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Navbar />
      <div className="grow pt-16">{children}</div>
      <BlogFooter />
    </div>
  );
}
