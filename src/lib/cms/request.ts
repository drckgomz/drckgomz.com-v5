export class CmsInputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function boundedJson(request: Request, maximum = 16_384): Promise<unknown> {
  if (!request.body) throw new CmsInputError('JSON body required.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.length;
      if (length > maximum) { await reader.cancel(); throw new CmsInputError('Request body too large.', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new CmsInputError('Invalid JSON.'); }
}
export function cmsJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
}
