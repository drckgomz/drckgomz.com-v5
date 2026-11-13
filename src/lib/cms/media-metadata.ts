import { isSameOriginRequest } from '@/lib/auth/same-origin';
import { boundedJson, cmsJson, CmsInputError } from './request';

export type MediaMetadata = { id: string; caption: string | null; alt_text: string; title: string | null; revision: number };
export type MediaMetadataPatch = Omit<MediaMetadata, 'id' | 'revision'> & { expected_revision: number };
export type MetadataResult = { kind: 'ok'; item: MediaMetadata } | { kind: 'unavailable' | 'missing' | 'conflict' };
export function parseMediaMetadata(value: unknown): MediaMetadataPatch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CmsInputError('Invalid metadata.');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some(key => !['expected_revision','caption','alt_text','title'].includes(key)) || Object.keys(record).length !== 4) throw new CmsInputError('Only caption, alt text, title and revision are supported.');
  if (!Number.isSafeInteger(record.expected_revision) || Number(record.expected_revision) < 1) throw new CmsInputError('A current revision is required.', 428);
  for (const [key, max] of [['caption',2000],['alt_text',500],['title',240]] as const) {
    const field = record[key];
    if ((field === null && key !== 'alt_text')) continue;
    if (typeof field !== 'string' || field.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(field)) throw new CmsInputError(`Invalid ${key}.`);
  }
  return { expected_revision: Number(record.expected_revision), caption: record.caption as string | null, title: record.title as string | null, alt_text: record.alt_text as string };
}
export function createMediaMetadataHandlers(deps: {
  authorize: () => Promise<Response | null>;
  read: (id: string) => Promise<MetadataResult>;
  write: (id: string, patch: MediaMetadataPatch) => Promise<MetadataResult>;
}) {
  function result(value: MetadataResult) {
    if (value.kind === 'ok') return cmsJson({ item: value.item });
    return cmsJson({ error: value.kind === 'unavailable' ? 'Media metadata persistence is unavailable; no changes were saved.' : value.kind === 'conflict' ? 'Media changed. Reload before saving.' : 'Media not found.' }, value.kind === 'unavailable' ? 503 : value.kind === 'conflict' ? 409 : 404);
  }
  return {
    async GET(_request: Request, id: string) {
      try { const denied = await deps.authorize(); if (denied) return denied;
        if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return cmsJson({ error: 'Invalid media identifier.' }, 400);
        return result(await deps.read(id));
      } catch { return cmsJson({ error: 'Media metadata unavailable.' }, 503); }
    },
    async PATCH(request: Request, id: string) {
      try { const denied = await deps.authorize(); if (denied) return denied;
        if (!isSameOriginRequest(request)) return cmsJson({ error: 'Same-origin request required.' }, 403);
        if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return cmsJson({ error: 'Invalid media identifier.' }, 400);
        return result(await deps.write(id, parseMediaMetadata(await boundedJson(request))));
      } catch (error) { return cmsJson({ error: error instanceof CmsInputError ? error.message : 'Media metadata unavailable; no changes confirmed.' }, error instanceof CmsInputError ? error.status : 503); }
    },
  };
}
