// frontend/src/features/terminal/lib/schema.ts
import { z } from "zod";

export const CommandActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("print"), text: z.string() }),
  z.object({ type: z.literal("navigate"), href: z.string() }),
  z.object({
    type: z.literal("openUrl"),
    url: z.string().url(),
    newTab: z.boolean().optional(),
  }),
  z.object({ type: z.literal("audio"), src: z.string().url() }),
  z.object({ type: z.literal("video"), src: z.string().url() }),
  z.object({
    type: z.literal("gallery"),
    images: z.array(z.string().url()),
  }),
]);

export const CommandSchema = z.object({
  // identity
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),

  // UX
  description: z.string().default(""),

  // actions
  actions: z.array(CommandActionSchema).min(1),

  // control flags (match DB + engine)
  requiresAuth: z.boolean().default(false),
  role: z.enum(["user", "admin"]).default("user"),
  showInHelp: z.boolean().default(true),
  enabled: z.boolean().default(true),
  rateLimitPerMin: z.number().int().nonnegative().default(0),
});

export type Command = z.infer<typeof CommandSchema>;
export type CommandAction = z.infer<typeof CommandActionSchema>;
