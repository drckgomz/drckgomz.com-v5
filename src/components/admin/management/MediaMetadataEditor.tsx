'use client';
import { useState } from 'react';
import type { MediaMetadata } from '@/lib/cms/media-metadata';
export default function MediaMetadataEditor({ initial }: { initial: MediaMetadata }) {
  const [item, setItem] = useState(initial);
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  return <form className="space-y-3 rounded border border-border p-3" onSubmit={async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setNotice('');
    try { const response = await fetch(`/api/admin/media/${encodeURIComponent(item.id)}/metadata`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption: item.caption, title: item.title, alt_text: item.alt_text, expected_revision: item.revision }) });
      const json = await response.json(); if (!response.ok) throw new Error(json.error || 'Save failed.'); setItem(json.item); setNotice('Media metadata saved.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Save failed.'); } finally { setBusy(false); }
  }}>
    <label className="block">Title<input maxLength={240} value={item.title || ''} onChange={e => setItem({ ...item, title: e.target.value })} className="block w-full rounded border border-border bg-background p-2" /></label>
    <label className="block">Alt text<input maxLength={500} value={item.alt_text} onChange={e => setItem({ ...item, alt_text: e.target.value })} className="block w-full rounded border border-border bg-background p-2" /></label>
    <label className="block">Caption<textarea maxLength={2000} value={item.caption || ''} onChange={e => setItem({ ...item, caption: e.target.value })} className="block w-full rounded border border-border bg-background p-2" /></label>
    <button type="submit" disabled={busy} className="rounded border border-border p-3">{busy ? 'Saving…' : 'Save media metadata'}</button><p role="status">{notice}</p>
  </form>;
}

export function MediaMetadataLoader({ id }: { id: string }) {
  const [item, setItem] = useState<MediaMetadata | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  return <div className="space-y-2">{!item && <button type="button" disabled={busy} className="rounded border border-border p-3" onClick={async () => {
    setBusy(true); setError('');
    try { const response = await fetch(`/api/admin/media/${encodeURIComponent(id)}/metadata`, { cache: 'no-store' }); const json = await response.json(); if (!response.ok) throw new Error(json.error || 'Metadata unavailable.'); setItem(json.item); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Metadata unavailable.'); } finally { setBusy(false); }
  }}>{busy ? 'Loading metadata…' : 'Edit metadata'}</button>}{error && <p role="alert">{error}</p>}{item && <MediaMetadataEditor initial={item} />}</div>;
}
