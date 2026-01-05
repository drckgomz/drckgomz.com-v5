// src/app/(protected)/blog/layout.tsx
import Navbar from "@/components/blog/Navbar";
import BlogFooter from "@/components/blog/BlogFooter";

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      <Navbar />
      <main className="grow">{children}</main>
      <BlogFooter />
    </div>
  );
}
