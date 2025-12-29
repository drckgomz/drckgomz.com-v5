// src/app/(protected)/blog/page.tsx  (SERVER)
import { currentUser } from "@clerk/nextjs/server";
import Navbar from "@/components/blog/Navbar.server";
import BlogFooter from "@/components/blog/BlogFooter";
import AllPostsGrid from "@/components/blog/AllPostsGrid";

export default async function BlogPage() {
  const user = await currentUser(); // middleware already ensured signed-in

  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      <Navbar />

      <main className="flex-grow mt-28 px-6 w-full max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-4 text-center">
          Welcome to the Blog{user?.firstName ? `, ${user.firstName}` : ""}!
        </h1>

        <div className="w-[85%] mx-auto flex justify-center items-center">
          <AllPostsGrid hideTitle />
        </div>
      </main>

      <BlogFooter />
    </div>
  );
}
