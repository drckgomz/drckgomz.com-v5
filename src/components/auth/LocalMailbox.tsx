"use client";

import Link from "next/link";
import { useState } from "react";
import { ResetPasswordForm } from "@/components/auth/BetterAuthRecoveryForms";
import type { LocalAuthMessage } from "@/lib/auth/local-mailbox";

export function LocalMailbox({ initialMessages, available }: { initialMessages: LocalAuthMessage[]; available: boolean }) {
  const [messages, setMessages] = useState(initialMessages);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function verify(message: LocalAuthMessage) {
    setBusy(message.id); setStatus(null);
    try {
      const response = await fetch("/api/dev/mailbox", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: message.kind, token: message.token }), cache: "no-store",
      });
      if (!response.ok) throw new Error();
      setMessages((current) => current.filter((entry) => entry.id !== message.id));
      setStatus("Email verified. You can now sign in.");
    } catch { setStatus("This verification message is expired or invalid."); }
    finally { setBusy(null); }
  }

  return <main className="mx-auto min-h-dvh max-w-3xl space-y-6 bg-black px-4 py-12 text-white">
    <Link href="/" className="text-sm underline">← Home</Link>
    <h1 className="text-3xl font-semibold">Local development inbox</h1>
    <p className="text-sm text-white/70">Only available in the loopback-only Phase 6 development runtime. Links expire and messages are removed after 24 hours.</p>
    {!available ? <p role="status">The local inbox is unavailable in this runtime.</p> : messages.length === 0 ? <p role="status">No local verification or password reset messages yet.</p> : <ul className="space-y-4">
      {messages.map((message) => <li key={message.id} className="space-y-2 rounded-lg border border-white/15 p-4">
        <p className="font-medium">{message.kind === "password-reset" ? "Password reset" : "Email verification"}</p>
        <p className="text-sm text-white/70">{message.email} · {new Date(message.createdAt).toLocaleString()}</p>
        {message.kind === "password-reset" ? <button type="button" className="text-cyan-200 underline" onClick={() => { setSelected(message.token); setStatus(null); }}>Open reset form</button> :
          <button type="button" disabled={busy === message.id} className="text-cyan-200 underline disabled:opacity-50" onClick={() => void verify(message)}>{busy === message.id ? "Verifying…" : "Verify email"}</button>}
      </li>)}
    </ul>}
    {status ? <p role="status">{status} {status.includes("verified") ? <Link href="/sign-in" className="underline">Sign in</Link> : null}</p> : null}
    {selected ? <div className="space-y-2 border-t border-white/15 pt-6"><button className="text-sm underline" onClick={() => setSelected(null)}>Close reset form</button><ResetPasswordForm token={selected} onSuccess={() => {
      setStatus("Password changed. Existing sessions were revoked; sign in with the new password.");
    }} /></div> : null}
  </main>;
}
