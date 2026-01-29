// src/app/admin/terminal/commands/[id]/types.ts
export type Cmd = {
  id: number;
  name: string;
  aliases: string[];
  description: string;
  actions: any[];
  requires_auth: boolean;
  role: string;
  show_in_help: boolean;
  enabled: boolean;
  rate_limit_per_min: number;
};

export type ActionKind = "navigate" | "openUrl" | "audio" | "video" | "image";
