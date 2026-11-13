import { publicDestinations } from '@/lib/site/public-config';
import { z } from 'zod';
import { editorLink } from './editor-policy';
const text = (maximum: number) => z.string().max(maximum).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value), 'Control characters are not allowed.');
const slug = z.string().min(1).max(240).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const id = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const link = text(2048).refine(value => value === '' || editorLink(value) !== null, 'Unsupported destination.');
const tags = z.array(text(40).min(1)).max(30).refine(values => new Set(values.map(v => v.toLowerCase())).size === values.length, 'Tags must be unique.');
export const projectSchema = z.object({ title: text(240).min(1), slug, excerpt: text(2000), content: text(2_000_000), href: link,
  idx: z.number().int().min(0).max(100_000), publication_state: z.enum(['draft','published','archived']), visibility: z.enum(['public','private']),
  technologies: tags, media_ids: z.array(id).max(50).refine(values => new Set(values).size === values.length), featured_media_id: id.nullable(),
}).strict().refine(value => value.featured_media_id === null || value.media_ids.includes(value.featured_media_id), 'Featured media must belong to the project gallery.');
export const userAccessSchema = z.object({ roles: z.array(z.enum(['content_admin','whitelist_manager'])).max(2).refine(values => new Set(values).size === values.length, 'Roles must be unique.'), enabled: z.boolean(), banned: z.boolean() }).strict();
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
function luminance(hexColor: string) { const channels = [1,3,5].map(i => parseInt(hexColor.slice(i, i + 2),16) /255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4); return .2126*channels[0]+.7152*channels[1]+.0722*channels[2]; }
function contrast(a: string,b: string) { const x=luminance(a), y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
const palette = z.object({ background: hex, foreground: hex, primary: hex, primary_foreground: hex }).strict()
  .refine(value => contrast(value.background,value.foreground)>=4.5 && contrast(value.primary,value.primary_foreground)>=4.5, 'Text/color pairs must have at least 4.5:1 contrast.');
export const appearanceSchema = z.object({ light: palette.nullable(), dark: palette.nullable(), font: z.enum(['system','serif','mono']), reading_size: z.number().int().min(14).max(24), mode: z.enum(['light','dark','system']) }).strict();
export const navigationSchema = z.object({ items: z.array(z.object({ label: text(60).min(1), href: link.refine(value => (publicDestinations as readonly string[]).includes(value), 'Choose an implemented public destination.') }).strict()).min(1).max(12) }).strict()
  .refine(value => new Set(value.items.map(item => item.href)).size === value.items.length, 'Destinations must be unique.');
export const homepageSchema = z.object({ title: text(120).min(1), description: text(2000), enabled: z.boolean() }).strict();
export const siteSettingsSchema = z.object({ title: text(120).min(1), description: text(320), profile_name: text(120), bio: text(2000), social_links: z.array(z.object({ label: text(60).min(1), href: link.refine(value => /^https:\/\//.test(value), 'Social links require HTTPS.') }).strict()).max(12) }).strict();
export const resourceSchemas = { projects: projectSchema, users: userAccessSchema, appearance: appearanceSchema, navigation: navigationSchema, homepage: homepageSchema, settings: siteSettingsSchema };
export type CmsSection = keyof typeof resourceSchemas;
export function isCmsSection(value: string): value is CmsSection { return Object.hasOwn(resourceSchemas,value); }
export type CmsMutation = { operation: 'create'|'update'|'delete'; id: string; expected_revision?: number; data?: unknown; publication?: 'draft'|'published' };
export function parseCmsMutation(section: CmsSection, value: unknown): CmsMutation {
  const base = z.object({ operation: z.enum(['create','update','delete']), id, expected_revision: z.number().int().positive().optional(), data: z.unknown().optional(), publication: z.enum(['draft','published']).optional() }).strict().parse(value);
  if (base.operation !== 'create' && !base.expected_revision) throw new Error('A current revision is required.');
  if (base.publication && ['projects','users'].includes(section)) throw new Error('Publication mode is not supported for this section.');
  if (section !== 'projects' && base.operation !== 'update') throw new Error('This section supports updates only.');
  if (base.operation === 'delete') { if (base.data !== undefined) throw new Error('Delete does not accept data.'); return base; }
  return { ...base, data: resourceSchemas[section].parse(base.data) };
}
