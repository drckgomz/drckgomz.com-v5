"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createAuthClient } from "better-auth/react";
import { Button } from "@/components/ui/button";

const authClient = createAuthClient({ basePath: "/api/auth" });

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null);
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    try {
      const result = await authClient.requestPasswordReset({ email, redirectTo: `${window.location.origin}/reset-password` });
      if (result.error) throw new Error("Request failed");
      setSent(true);
    } catch { setError("Password recovery is temporarily unavailable. Try again shortly."); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-white/10 bg-black/70 p-6 text-white">
    <h1 className="text-xl font-semibold">Reset your password</h1>
    <p className="text-sm text-white/70">
      Enter your email. The response is intentionally generic; only an account already enrolled in this local Better Auth database receives a reset message. Legacy provider accounts were not imported.
    </p>
    <label htmlFor="recovery-email" className="block space-y-1 text-sm">Email address
      <input id="recovery-email" name="email" type="email" autoComplete="email" required maxLength={254} className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-base" />
    </label>
    {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}
    {sent ? <p role="status" className="text-sm text-emerald-200">If an account is eligible, its reset link is available in the local email inbox. No message is sent for identities that are not enrolled here.</p> : null}
    <Button disabled={pending} className="w-full">{pending ? "Sending…" : "Send reset link"}</Button>
    <p className="text-sm text-white/70"><Link className="underline" href="/sign-in">Back to sign in</Link> · <Link className="underline" href="/dev/mailbox">Local inbox</Link></p>
  </form>;
}

export function ResetPasswordForm({ token, onSuccess }: { token: string; onSuccess?: () => void }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(null); setMessage(null);
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("password") ?? "");
    const confirm = String(form.get("confirmPassword") ?? "");
    if (!token) { setError("This reset link is missing or invalid."); setPending(false); return; }
    if (newPassword !== confirm) { setError("Passwords do not match."); setPending(false); return; }
    try {
      const result = await authClient.resetPassword({ newPassword, token });
      if (result.error) throw new Error("Invalid token");
      setMessage("Your password was changed and existing sessions were revoked. You can now sign in.");
      onSuccess?.();
    } catch { setError("This reset link is invalid, expired, or already used. Request a new link."); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-white/10 bg-black/70 p-6 text-white">
    <h1 className="text-xl font-semibold">Choose a new password</h1>
    <label htmlFor="reset-password" className="block space-y-1 text-sm">New password
      <input id="reset-password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-base" />
    </label>
    <label htmlFor="reset-confirm" className="block space-y-1 text-sm">Confirm new password
      <input id="reset-confirm" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-base" />
    </label>
    {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}
    {message ? <p role="status" className="text-sm text-emerald-200">{message} <Link className="underline" href="/sign-in">Sign in</Link></p> : null}
    <Button disabled={pending || !token} className="w-full">{pending ? "Updating…" : "Set new password"}</Button>
  </form>;
}
