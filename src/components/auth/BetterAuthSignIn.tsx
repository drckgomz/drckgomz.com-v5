"use client";

import { useState, type FormEvent } from "react";
import { createAuthClient } from "better-auth/react";
import { Button } from "@/components/ui/button";
import { BetterAuthSocialButtons, type SocialProviderId } from "@/components/auth/BetterAuthSocialButtons";
import Link from "next/link";

const authClient = createAuthClient({ basePath: "/api/auth" });

export function BetterAuthSignIn({ redirectTo, providers, localEmailEnabled }: { redirectTo: string; providers: SocialProviderId[]; localEmailEnabled: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const values = new FormData(event.currentTarget);
    const email = values.get("email");
    const password = values.get("password");
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      setError("Enter your email and password.");
      setPending(false);
      return;
    }
    try {
      const result = await authClient.signIn.email({ email: email.trim(), password, callbackURL: redirectTo });
      if (result.error) {
        setError("Sign-in failed. Check your details or verify your email.");
        return;
      }
      window.location.assign(redirectTo);
    } catch {
      setError("Sign-in is temporarily unavailable. Try again shortly.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-xl border border-white/10 bg-black/70 p-6 text-white shadow-xl">
      <h1 className="text-xl font-semibold">Sign in</h1>
      {providers.length > 0 ? <BetterAuthSocialButtons providers={providers} callbackURL={redirectTo} /> : null}
      {providers.length > 0 ? <p className="text-center text-xs text-white/60">or sign in with your existing email account</p> : null}
      <div className="space-y-2">
        <label htmlFor="auth-email" className="text-sm">Email</label>
        <input id="auth-email" name="email" type="email" autoComplete="username" required disabled={pending}
          className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" />
      </div>
      <div className="space-y-2">
        <label htmlFor="auth-password" className="text-sm">Password</label>
        <input id="auth-password" name="password" type="password" autoComplete="current-password" required disabled={pending}
          className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" />
      </div>
      {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="flex justify-between text-sm text-white/70">{localEmailEnabled ? <Link className="underline" href="/forgot-password">Forgot password?</Link> : <span>Password recovery is unavailable here.</span>} {localEmailEnabled ? <Link className="underline" href="/sign-up">Create account</Link> : null}</p>
    </form>
  );
}
