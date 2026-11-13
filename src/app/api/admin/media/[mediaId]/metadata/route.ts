import { requireAdminApi } from '@/lib/admin/requireAdminApi';
import { createMediaMetadataHandlers } from '@/lib/cms/media-metadata';
import { ownerMediaMetadata } from '@/lib/db/repositories/media-metadata';
const handlers = createMediaMetadataHandlers({
  authorize: () => requireAdminApi('posts:update'),
  read: id => ownerMediaMetadata(id, null), write: ownerMediaMetadata,
});
export async function GET(request: Request, context: { params: Promise<{ mediaId: string }> }) { return handlers.GET(request, (await context.params).mediaId); }
export async function PATCH(request: Request, context: { params: Promise<{ mediaId: string }> }) { return handlers.PATCH(request, (await context.params).mediaId); }
