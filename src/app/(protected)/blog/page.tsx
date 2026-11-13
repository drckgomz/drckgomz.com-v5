// src/app/(protected)/blog/page.tsx  (SERVER)
import AllPostsGrid from "@/components/blog/AllPostsGrid";
import { getViewer } from "@/lib/auth/viewer";
import { isOfflineDesignMode } from "@/lib/offline-design-mode";
import { offlineBlogPosts } from "@/lib/blog/offline-samples";

export default async function BlogPage() {
  const offlinePreview = isOfflineDesignMode({ NODE_ENV: process.env.NODE_ENV, OFFLINE_DESIGN_MODE: process.env.OFFLINE_DESIGN_MODE });
  if (offlinePreview) {
    return (
      <main className="grow mt-28 px-6 w-full max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-4 text-center">Welcome to the Blog!</h1>
        <div className="w-full">
          <AllPostsGrid hideTitle offlinePosts={offlineBlogPosts} offlinePreview />
        </div>
      </main>
    );
  }
  const { profile } = await getViewer();

  return (
    <main className="grow mt-28 px-6 w-full max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-4 text-center">
        Welcome to the Blog{profile?.display_name ? `, ${profile.display_name}` : ""}!
      </h1>

      <div className="w-full">
        <AllPostsGrid hideTitle />
      </div>
    </main>
  );
}
