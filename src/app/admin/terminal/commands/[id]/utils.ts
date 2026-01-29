// src/app/admin/terminal/commands/[id]/utils.ts
import type { ActionKind } from "./types";

export function buildActionsFromBuilder(kind: ActionKind, targetUrl: string, newTab: boolean): any[] {
  switch (kind) {
    case "navigate":
      return [{ type: "navigate", href: targetUrl || "/" }];
    case "openUrl":
      return [{ type: "openUrl", url: targetUrl || "https://example.com", newTab }];
    case "audio":
      return [{ type: "audio", src: targetUrl || "https://example.com/audio.mp3" }];
    case "video":
      return [{ type: "video", src: targetUrl || "https://example.com/video.mp4" }];
    case "image":
      return [{ type: "gallery", images: [targetUrl || "https://example.com/image.jpg"] }];
    default:
      return [];
  }
}

export function inferBuilderFromActions(actions: any[]): {
  kind: ActionKind;
  targetUrl: string;
  newTab: boolean;
} {
  let kind: ActionKind = "navigate";
  let targetUrl = "";
  let newTab = true;

  if (!Array.isArray(actions) || actions.length === 0) return { kind, targetUrl, newTab };

  const a = actions[0];

  if (a?.type === "navigate" && typeof a?.href === "string") {
    kind = "navigate";
    targetUrl = a.href;
  } else if (a?.type === "openUrl" && typeof a?.url === "string") {
    kind = "openUrl";
    targetUrl = a.url;
    newTab = !!a.newTab;
  } else if (a?.type === "audio" && typeof a?.src === "string") {
    kind = "audio";
    targetUrl = a.src;
  } else if (a?.type === "video" && typeof a?.src === "string") {
    kind = "video";
    targetUrl = a.src;
  } else if (a?.type === "gallery" && Array.isArray(a?.images) && a.images[0]) {
    kind = "image";
    targetUrl = a.images[0];
  }

  return { kind, targetUrl, newTab };
}
