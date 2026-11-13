/** Supports existing reorder aliases, rejecting malformed items instead of dropping them. */
export function parseMediaOrder(body: unknown): string[] | null {
  const record = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  const candidate = Array.isArray(body) ? body : record?.order ?? record?.ordered ?? record?.items ?? record?.list ?? record?.media ?? record?.data ?? record?.payload ?? record?.ids;
  if (!Array.isArray(candidate) || !candidate.length || candidate.length > 1000) return null;
  const ids: string[] = [];
  for (const item of candidate) {
    const row = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : null;
    const raw = row ? row.id ?? row.mediaId ?? row.value : item;
    if ((typeof raw !== "string" && typeof raw !== "number") || (typeof raw === "number" && !Number.isSafeInteger(raw))) return null;
    const id = String(raw).trim();
    if (!id || id.length > 240 || /[\u0000-\u001f\u007f]/.test(id)) return null;
    ids.push(id);
  }
  return new Set(ids).size === ids.length ? ids : null;
}
