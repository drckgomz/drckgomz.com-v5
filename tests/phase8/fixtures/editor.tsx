import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ResourceEditor from '../../../src/components/admin/management/ResourceEditor';
import type { CmsSection } from '../../../src/lib/cms/contracts';
import Editor from '../../../src/components/admin/editor/Editor';
import EditPostForm from '../../../src/components/admin/posts/EditPostForm';
const params = new URLSearchParams(location.search);
function Fixture() {
  const [html, setHtml] = useState('<p>Alpha beta</p>');
  const resource = params.get('resource') as CmsSection | null;
  const values: Record<string, Record<string, unknown>> = {
    homepage: { title: 'Synthetic homepage', description: 'Description', enabled: true },
    navigation: { items: [{ label: 'Blog', href: '/blog' }, { label: 'Projects', href: '/projects' }] },
    settings: { title: 'Synthetic site', description: 'SEO', profile_name: 'Synthetic profile', bio: '', social_links: [] },
    appearance: { light: null, dark: null, mode: 'dark', font: 'system', reading_size: 16 },
    users: { roles: [], enabled: true, banned: false },
    projects: { title: '', slug: '', excerpt: '', content: '', href: '', idx: 0, publication_state: 'draft', visibility: 'private', technologies: [], media_ids: [], featured_media_id: null },
  };
  if (params.has('gallery')) values.projects = { ...values.projects, title: 'Gallery project', slug: 'gallery-project', media_ids: ['image-a', 'image-b'] };
  return <main className="mx-auto max-w-5xl space-y-4 p-4" data-theme="dark" data-theme-scope="admin">
    <h1>Synthetic editor verification</h1><p>No database or authentication integration; component contract fixture only.</p>
    {/* Native navigation is intentional in this provider-free contract fixture. */}
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
    <a href="/other">Navigate away</a>
    {resource && values[resource] ? <ResourceEditor section={resource} id={resource} initial={values[resource]} create={resource === 'projects' && !params.has('gallery')} protectedAccount={params.has('protected')} /> : params.has('form') ? <EditPostForm metadataEditable={params.has('metadata')} initialPost={{ id: 'synthetic-overnight', slug: 'synthetic-overnight', title: 'Synthetic draft', excerpt: null,
      content: '<p>Rendered preview output</p>', editor_content: params.has('legacy') ? null : '<p>Original raw source</p>', legacy_content: params.has('legacy'), status: 'draft', date: null, thumbnail_url: null, revision: 1, media: [] }} />
      : <><Editor value={html} onChange={setHtml} /><label>Serialized HTML<textarea readOnly value={html} className="block w-full" /></label></>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
