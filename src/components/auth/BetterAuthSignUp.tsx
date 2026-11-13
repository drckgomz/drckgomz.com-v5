"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createAuthClient } from "better-auth/react";
import { Button } from "@/components/ui/button";

const authClient = createAuthClient({ basePath: "/api/auth" });

export function BetterAuthSignUp() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError(null); setMessage(null);
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    if (password !== confirmPassword) {
      setError("Passwords do not match."); setPending(false); return;
    }
    if (password.length < 12 || password.length > 128 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/(?:\d|[^A-Za-z0-9])/.test(password)) {
      setError("Use 12–128 characters with lowercase, uppercase, and a number or symbol."); setPending(false); return;
    }
    try {
      const result = await authClient.signUp.email({ name, email, password, callbackURL: "/blog" });
      if (result.error) {
        setError("We could not complete registration. Check the information or try again later.");
      } else {
        setMessage("If registration completed, check the local email inbox for a verification link before signing in.");
        event.currentTarget.reset();
      }
    } catch {
      setError("Registration is temporarily unavailable. Try again shortly.");
    } finally { setPending(false); }
  }

  return <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-white/10 bg-black/70 p-6 text-white shadow-xl">
    <h1 className="text-xl font-semibold">Create your account</h1>
    <p className="text-sm text-white/70">New accounts can read public posts. Private access is approved separately.</p>
    <label className="block space-y-1 text-sm" htmlFor="signup-name">Display name
      <input id="signup-name" name="name" required maxLength={80} autoComplete="name" disabled={pending} className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-base focus-visible:ring-2 focus-visible:ring-cyan-300" />
    </label>
    <label className="block space-y-1 text-sm" htmlFor="signup-email">Email address
      <input id="signup-email" name="email" type="email" required maxLength={254} autoComplete="email" disabled={pending} className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-base focus-visible:ring-2 focus-visible:ring-cyan-300" />
    </label>
    <label className="block space-y-1 text-sm" htmlFor="signup-password">Password
      <input id="signup-password" name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" disabled={pending} className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-base focus-visible:ring-2 focus-visible:ring-cyan-300" />
    </label>
    <label className="block space-y-1 text-sm" htmlFor="signup-confirm">Confirm password
      <input id="signup-confirm" name="confirmPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" disabled={pending} className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-base focus-visible:ring-2 focus-visible:ring-cyan-300" />
    </label>
    {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}
    {message ? <p role="status" className="text-sm text-emerald-200">{message} <Link className="underline" href="/dev/mailbox">Open local inbox</Link></p> : null}
    <Button type="submit" disabled={pending} className="w-full">{pending ? "Creating account…" : "Create account"}</Button>
    <p className="text-sm text-white/70">Already registered? <Link className="underline" href="/sign-in">Sign in</Link></p>
  </form>;
}
