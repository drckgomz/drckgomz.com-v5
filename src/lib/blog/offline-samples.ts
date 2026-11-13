import type { MediaItem } from "./render";

export type OfflineBlogPost = {
  id: string;
  slug: string;
  title: string;
  status: "public";
  date: string;
  created_at: string;
  updated_at: string;
  thumbnail_url: string;
  content: string;
  media: MediaItem[];
};

const fixtureImage = "/offline-blog-fixture.svg";

export const offlineBlogPosts: OfflineBlogPost[] = [
  {
    id: "offline-public-fixture-1",
    slug: "offline-public-sample-one",
    title: "LOCAL SAMPLE — Public post",
    status: "public",
    date: "2025-06-14T12:00:00.000Z",
    created_at: "2025-06-14T12:00:00.000Z",
    updated_at: "2025-06-14T12:00:00.000Z",
    thumbnail_url: fixtureImage,
    content: `
      <p>This is clearly labeled local fixture content. The original post record and image are not available in the offline preview.</p>
      <h2>Sample article section</h2>
      <p>The existing article renderer displays the public fixture using the normal blog typography and spacing.</p>
      <figure class="flex flex-col items-center my-4">
        <img src="${fixtureImage}" alt="Local sample image fixture" class="rounded-lg max-w-full" loading="lazy" />
        <figcaption class="text-sm text-gray-400 mt-2 text-center">Local sample image fixture — not original post media.</figcaption>
      </figure>
      <div class="media-placeholder rounded-lg bg-cyan-500/10 p-4 text-center"><p class="font-semibold">Embedded media fixture</p><p>External embeds are not loaded in offline mode.</p></div>
    `,
    media: [{ id: "offline-public-media-1", type: "image", url: fixtureImage, caption: "Local sample image fixture" }],
  },
  {
    id: "offline-public-fixture-2",
    slug: "offline-public-sample-two",
    title: "LOCAL SAMPLE — Second public post",
    status: "public",
    date: "2025-03-02T15:00:00.000Z",
    created_at: "2025-03-02T15:00:00.000Z",
    updated_at: "2025-03-02T15:00:00.000Z",
    thumbnail_url: fixtureImage,
    content: `
      <p>This sample stands in for an original public article while provider credentials are unavailable.</p>
      <h2>Formatting preview</h2>
      <p>The existing renderer supports paragraphs, headings, code, figures, captions, and embedded media placeholders.</p>
      <pre><code>// Local fixture only
const previewMode = true;</code></pre>
      <figure class="flex flex-col items-center my-4">
        <img src="${fixtureImage}" alt="Local sample image fixture" class="rounded-lg max-w-full" loading="lazy" />
        <figcaption class="text-sm text-gray-400 mt-2 text-center">Local sample image fixture — not original post media.</figcaption>
      </figure>
      <div class="media-placeholder rounded-lg bg-cyan-500/10 p-4 text-center"><p class="font-semibold">Embedded media fixture</p><p>No external provider is contacted.</p></div>
    `,
    media: [{ id: "offline-public-media-2", type: "image", url: fixtureImage, caption: "Local sample image fixture" }],
  },
];

export function getOfflineBlogPost(slug: string): OfflineBlogPost | null {
  return offlineBlogPosts.find((post) => post.slug === slug) ?? null;
}
