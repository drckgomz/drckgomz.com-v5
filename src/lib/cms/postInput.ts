/** Runtime validation independent of storage/auth providers. Legacy IDs/HTML remain intact. */
export const POST_STATUSES = ["draft", "private", "public", "archived"] as const;
export type PostFields = {
  title?: string; slug?: string; excerpt?: string | null; content?: string | null;
  status?: typeof POST_STATUSES[number]; date?: string | null; thumbnail_url?: string | null;
};
export function validatePostInput(input: unknown, create = false): { fields: PostFields; expectedUpdatedAt?: string | null; error?: string } {
  const fields: Record<string, string | null> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return { fields, error: "Expected a JSON object." };
  const body = input as Record<string, unknown>;
  const limits: Record<string, number> = { title: 240, slug: 240, excerpt: 2000, content: 2_000_000, status: 20, date: 40, thumbnail_url: 2048 };
  if (!Object.keys(body).length || Object.keys(body).some(key => !Object.hasOwn(limits, key) && key !== "expected_updated_at")) return { fields, error: "Unsupported or empty post fields." };
  for (const [key, value] of Object.entries(body)) {
    if (key === "expected_updated_at") continue;
    if (value === null && !["title", "slug", "status"].includes(key)) { fields[key] = null; continue; }
    if (typeof value !== "string" || value.length > limits[key]) return { fields, error: `Invalid ${key}.` };
    fields[key] = key === "content" ? value : value.trim();
  }
  for (const key of ["title", "slug"]) if ((create || key in fields) && !fields[key]) return { fields, error: `${key} is required.` };
  if (fields.slug && /[\u0000-\u001f\u007f/?#]/.test(fields.slug)) return { fields, error: "Slug cannot contain URL separators or control characters." };
  if ("status" in fields && !(POST_STATUSES as readonly string[]).includes(fields.status ?? "")) return { fields, error: "Invalid publication status." };
  if (fields.date && (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(fields.date) || !Number.isFinite(Date.parse(fields.date)))) return { fields, error: "Invalid publication date." };
  if (fields.date && /^\d{4}-\d{2}-\d{2}/.test(fields.date) && new Date(fields.date.slice(0, 10)).toISOString().slice(0, 10) !== fields.date.slice(0, 10)) return { fields, error: "Invalid calendar date." };
  if (fields.thumbnail_url) {
    try {
      const url = new URL(fields.thumbnail_url, "https://relative.invalid");
      if (!['https:', 'http:'].includes(url.protocol) || /[\u0000-\u001f\u007f\\]/.test(fields.thumbnail_url)) throw new Error();
    } catch { return { fields, error: "Thumbnail must be an HTTP URL or object key." }; }
  }
  if (!Object.keys(fields).length) return { fields, error: "At least one post field is required." };
  const expected = body.expected_updated_at;
  if (expected !== undefined && expected !== null && (typeof expected !== "string" || !Number.isFinite(Date.parse(expected)))) return { fields, error: "Invalid revision timestamp." };
  return { fields: fields as PostFields, expectedUpdatedAt: expected as string | null | undefined };
}
