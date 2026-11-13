import { LocalMailbox } from "@/components/auth/LocalMailbox";
import { listLocalAuthMessages } from "@/lib/auth/local-mailbox";

export const dynamic = "force-dynamic";

export default async function LocalMailboxPage() {
  let messages: Awaited<ReturnType<typeof listLocalAuthMessages>> = [];
  let available = true;
  try {
    messages = await listLocalAuthMessages();
  } catch { available = false; }
  return <LocalMailbox initialMessages={messages} available={available} />;
}
