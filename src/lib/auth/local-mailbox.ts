import "server-only";
import { randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isLocalPostgresIntegrationEnabled, parseLocalPostgresTarget } from "@/lib/db/local-postgres-target";

export type LocalAuthMessage = {
  id: string;
  kind: "email-verification" | "password-reset";
  email: string;
  token: string;
  createdAt: string;
};

const mailboxPath = resolve(".artifacts/phase6/local-mailbox.json");
let writeQueue: Promise<void> = Promise.resolve();

function assertLocalMailbox() {
  if (!isLocalPostgresIntegrationEnabled(process.env) || process.env.NODE_ENV !== "development" ||
      process.env.LOCAL_MAILBOX_PATH !== mailboxPath) {
    throw new Error("Local email delivery is available only in the pinned Phase 6 development runtime.");
  }
  parseLocalPostgresTarget(process.env, "auth");
}

async function readMessages(): Promise<LocalAuthMessage[]> {
  try {
    const metadata = await lstat(mailboxPath);
    if (!metadata.isFile() || metadata.isSymbolicLink() || (metadata.mode & 0o077) !== 0) {
      throw new Error("Local mailbox file permissions are unsafe.");
    }
    const parsed: unknown = JSON.parse(await readFile(mailboxPath, "utf8"));
    return Array.isArray(parsed) ? parsed.map(normalizeMessage).filter((entry): entry is LocalAuthMessage => entry !== null) : [];
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

function normalizeMessage(value: unknown): LocalAuthMessage | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if ((item.kind !== "email-verification" && item.kind !== "password-reset") ||
      typeof item.email !== "string" || typeof item.createdAt !== "string") return null;
  let token = typeof item.token === "string" ? item.token : "";
  // Upgrade inbox rows written by the earlier local-only URL format in memory;
  // never serialize their query/path token back into a link or log.
  if (!token && typeof item.url === "string") {
    try {
      const url = new URL(item.url);
      token = url.searchParams.get("token") ?? url.pathname.split("/").at(-1) ?? "";
    } catch { return null; }
  }
  if (!token || token.length > 2048) return null;
  return { id: typeof item.id === "string" ? item.id : randomUUID(), kind: item.kind, email: item.email, token, createdAt: item.createdAt };
}

export async function appendLocalAuthMessage(message: Omit<LocalAuthMessage, "id">) {
  assertLocalMailbox();
  if (message.email.length > 254 || message.token.length > 2048 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(message.email)) {
    throw new Error("Local auth email content did not match the allowed development format.");
  }
  const task = writeQueue.then(async () => {
    const directory = resolve(".artifacts/phase6");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700);
    const existing = await readMessages();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const retained = existing.filter((entry) => Date.parse(entry.createdAt) > cutoff).slice(-19);
    const temporary = resolve(directory, `.mailbox-${randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify([...retained, { ...message, id: randomUUID() }]), { flag: "wx", mode: 0o600 });
    await rename(temporary, mailboxPath);
    await chmod(mailboxPath, 0o600);
  });
  writeQueue = task.catch(() => {});
  await task;
}

export async function listLocalAuthMessages() {
  assertLocalMailbox();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return (await readMessages()).filter((entry) => Date.parse(entry.createdAt) > cutoff).slice(-20).reverse();
}
