"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export default function ReloadStatus() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button type="button" disabled={pending} aria-busy={pending} onClick={() => startTransition(() => router.refresh())} className="rounded border border-border px-4 py-3">{pending ? "Reloading…" : "Reload status"}</button>;
}
