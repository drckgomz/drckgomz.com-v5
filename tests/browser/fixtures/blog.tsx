import React from "react";
import { createRoot } from "react-dom/client";
import InlineCarousel from "../../../src/components/home/sections/project/InlineCarousel";
import MediaCarousel from "../../../src/components/blog/MediaCarousel";
import ManagePostsPage from "../../../src/components/admin/posts/ManagePostsPage";
import BlogContent from "../../../src/components/blog/BlogContent";
import EditPostForm from "../../../src/components/admin/posts/EditPostForm";
import CreatePostForm from "../../../src/components/admin/posts/CreatePostForm";
import type { MediaItem } from "../../../src/lib/blog/render";

const paragraph = '<p>A synthetic field note about making things, learning slowly, and noticing small details. This article contains no personal records.</p>';
const formats = '<h2>Formats worth preserving</h2><p><strong>Bold</strong>, <em>italic</em>, <u>underline</u>, <s>struck</s>, <a href="/review?case=long">an internal reading link</a> and inline <code>const example = true</code>.</p><ul><li>First observation</li><li>Second observation</li></ul><ol><li>One</li><li>Two</li></ol><blockquote>A quiet synthetic quotation.</blockquote><details><summary>Interactive notes</summary><p>Native disclosure remains keyboard accessible.</p></details>';
const code = '<h2>Long text and code</h2><p>' + 'unbroken-synthetic-string'.repeat(22) + '</p><pre tabindex="0"><code>' + 'const synthetic = "' + 'long-code'.repeat(40) + '";</code></pre><table><tr><th>Format</th><th>Result</th></tr><tr><td>' + 'wide-cell-'.repeat(40) + '</td><td>Preserved</td></tr></table>';
const media: MediaItem[] = [
  { id: 'image-1', type: 'image', url: '/fixture-image.svg', caption: 'Synthetic landscape & caption' },
  { id: 'yt-1', type: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Synthetic video frame' },
  { id: 'ig-1', type: 'instagram', url: 'https://www.instagram.com/p/SYNTHETIC/', caption: 'Synthetic Instagram' },
];
const mixed = formats + '<script>window.syntheticAttack=true</script><img src="/fixture-image.svg" alt="Synthetic security fixture" onerror="window.syntheticAttack=true"><a href="javascript:window.syntheticAttack=true">Unsafe link</a><iframe src="https://evil.invalid/"></iframe>' + '<p>[MEDIA IMAGE: landscape (image-1)]</p><p>[MEDIA YOUTUBE: film (yt-1)]</p><p>[MEDIA INSTAGRAM: note (ig-1)]</p><img width="4000" height="2000" src="/fixture-image.svg" alt="Wide synthetic landscape"><video controls poster="/fixture-image.svg" aria-label="Synthetic video without source"></video><audio controls aria-label="Synthetic audio without source"></audio>' + code;
const query = new URLSearchParams(location.search);
const scenario = query.get('case') ?? 'long';
const theme = query.get('theme') === 'dark' ? 'dark' : 'light';
const scope = query.get('scope') ?? (scenario === 'admin' || scenario === 'create' ? 'admin' : 'blog');
document.documentElement.dataset.theme = theme;
document.documentElement.dataset.themeScope = scope;
const content = scenario === 'media' ? mixed.repeat(3) : scenario === 'mixed' ? mixed : formats + paragraph.repeat(24) + code;
const initialPost = { id: 'synthetic-post', slug: 'synthetic', title: 'Synthetic draft', excerpt: 'Fixture summary', content: mixed, status: 'draft', date: null, thumbnail_url: null, updated_at: '2026-01-01T00:00:00.000Z', media: [] };

function App() {
  return <div className="review-shell" data-theme={theme} data-theme-scope={scope}>
    <a className="review-skip" href="#content">Skip to content</a>
    <header><nav aria-label="Fixture navigation"><a href="/review?case=long">Journal</a><a href="/review?case=admin&theme=dark">Publishing</a></nav><span>LOCAL SYNTHETIC REVIEW</span></header>
    <main id="content">
      <h1>{scenario === 'admin' ? 'Draft publishing' : scenario === 'create' ? 'Create a draft' : 'A field note from the workshop'}</h1>
      {scenario === 'error' ? <section><h2>Post unavailable</h2><p role="status">The post could not be loaded. No private content is displayed.</p><a href="/review?case=long">Back to journal</a></section>
        : scenario === 'admin' ? <EditPostForm initialPost={initialPost} />
        : scenario === 'create' ? <CreatePostForm />
        : scenario === 'manage' ? <ManagePostsPage />
        : scenario === 'project-gallery' ? <InlineCarousel media={[{ id: 'hostile', type: 'youtube', url: 'https://evil.invalid/embed/player' }, { id: 'valid', type: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ' }]} />
        : scenario === 'gallery' ? <MediaCarousel media={media} />
        : <article aria-label="Synthetic article"><BlogContent content={content} media={media} /></article>}
    </main><footer>Synthetic fixtures. No provider connections or tracking.</footer>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App />);
