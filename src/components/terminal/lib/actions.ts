import { safeMediaUrl } from "@/lib/blog/render";
import type { EngineCommand } from "./engine";

export type TerminalAction = EngineCommand["actions"][number];
function safeTarget(value: unknown, mailto = false): value is string {
  if (typeof value !== "string" || !value || value.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(value)) return false;
  try {
    const url = new URL(value, "https://relative.invalid");
    return ["https:", "http:", ...(mailto ? ["mailto:"] : [])].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}
/** Runtime boundary for JSON/text actions, including direct engine registration. */
export function parseTerminalActions(input: unknown): TerminalAction[] | null {
  let rows = input;
  if (typeof rows === "string") { try { rows = JSON.parse(rows); } catch { return null; } }
  if (!Array.isArray(rows) || rows.length > 100) return null;
  const actions: TerminalAction[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    switch (row.type) {
      case "print":
        if (typeof row.text !== "string" || row.text.length > 100000) return null;
        actions.push({ type: "print", text: row.text }); break;
      case "navigate":
        if (!safeTarget(row.href)) return null;
        actions.push({ type: "navigate", href: row.href }); break;
      case "openUrl":
        if (!safeTarget(row.url, true) || (row.newTab !== undefined && typeof row.newTab !== "boolean")) return null;
        actions.push({ type: "openUrl", url: row.url, newTab: row.newTab }); break;
      case "audio": case "video":
        if (typeof row.src !== "string" || !safeMediaUrl(row.src)) return null;
        actions.push({ type: row.type, src: row.src }); break;
      case "gallery":
        if (!Array.isArray(row.images) || row.images.length > 100 || !row.images.every((url): url is string => typeof url === "string" && !!safeMediaUrl(url))) return null;
        actions.push({ type: "gallery", images: row.images }); break;
      default: return null;
    }
  }
  return actions;
}
