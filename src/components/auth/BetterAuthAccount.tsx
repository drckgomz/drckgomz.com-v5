"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createAuthClient } from "better-auth/react";
import { Button } from "@/components/ui/button";

const authClient = createAuthClient({ basePath: "/api/auth" });

export function BetterAuthAccount({ initialName, email, verified, showNameEditor = true }: { initialName: string; email: string; verified: boolean; showNameEditor?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null); setMessage(null);
    try {
      const result = await authClient.updateUser({ name: name.trim() });
      if (result.error) throw new Error();
      setMessage("Display name updated.");
    } catch { setError("Could not update your display name."); }
    finally { setPending(false); }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null); setMessage(null);
    try {
      const result = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
      if (result.error) throw new Error();
      setCurrentPassword(""); setNewPassword("");
      setMessage("Password changed. Other sessions were revoked.");
    } catch { setError("Could not change the password. Check the current password and strength requirements."); }
    finally { setPending(false); }
  }

  async function signOut() {
    setPending(true);
    try { await authClient.signOut(); router.replace("/blog"); }
    catch { setError("Sign out failed. Please retry."); setPending(false); }
  }

  return <section className="mx-auto w-full max-w-xl space-y-5 rounded-xl border border-white/10 bg-black/80 p-6 text-white">
    <h1 className="text-2xl font-semibold">Account settings</h1>
    <p className="text-sm text-white/70">Signed in as {email || "account"}</p>
    <p className="text-sm">Email verification: <strong>{verified ? "Verified" : "Not verified"}</strong></p>
    {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}
    {message ? <p role="status" className="text-sm text-emerald-200">{message}</p> : null}
    {showNameEditor ? <form onSubmit={saveName} className="space-y-3 border-t border-white/10 pt-4">
      <label htmlFor="account-name" className="block space-y-1 text-sm">Display name
        <input id="account-name" value={name} maxLength={80} required onChange={(event) => setName(event.target.value)} className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-base" />
      </label>
      <Button disabled={pending}>Save display name</Button>
    </form> : null}
    <form onSubmit={changePassword} className="space-y-3 border-t border-white/10 pt-4">
      <h2 className="font-medium">Change password</h2>
      <label htmlFor="current-password" className="block space-y-1 text-sm">Current password
        <input id="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-base" />
      </label>
      <label htmlFor="new-password" className="block space-y-1 text-sm">New password
        <input id="new-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-base" />
      </label>
      <Button disabled={pending}>Change password</Button>
    </form>
    <div className="flex flex-wrap gap-4 border-t border-white/10 pt-4 text-sm">
      {!verified ? <ResendVerification email={email} /> : null}
      <Link href="/blog" className="underline">Back to blog</Link>
      <button type="button" disabled={pending} onClick={() => void signOut()} className="underline disabled:opacity-50">Sign out</button>
    </div>
  </section>;
}

function ResendVerification({ email }: { email: string }) {
  const [message, setMessage] = useState<string | null>(null);
  async function resend() {
    try {
      const result = await authClient.sendVerificationEmail({ email, callbackURL: "/blog" });
      setMessage(result.error ? "Could not resend verification email." : "If eligible, a verification message was sent.");
    } catch { setMessage("Could not resend verification email."); }
  }
  return <span><button type="button" className="underline" onClick={() => void resend()}>Resend verification</button>{message ? <span role="status" className="ml-2">{message}</span> : null}</span>;
}
