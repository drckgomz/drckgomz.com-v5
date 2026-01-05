// src/app/(protected)/blog/page.tsx  (SERVER)
import { currentUser } from "@clerk/nextjs/server";
import AllPostsGrid from "@/components/blog/AllPostsGrid";

export default async function BlogPage() {
  const user = await currentUser();

  return (
    <main className="grow mt-28 px-6 w-full max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-4 text-center">
        Welcome to the Blog{user?.firstName ? `, ${user.firstName}` : ""}!
      </h1>

      <div className="w-full">
        <AllPostsGrid hideTitle />
      </div>
    </main>
  );
}
