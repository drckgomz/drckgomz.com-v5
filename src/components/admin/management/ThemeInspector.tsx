"use client";

import { useState } from "react";

export default function ThemeInspector({ tokens }: { tokens: { name: string; value: string }[] }) {
  const [theme, setTheme] = useState("dark");
  const [query, setQuery] = useState("");
  const filtered = tokens.filter(token => `${token.name} ${token.value}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="space-y-4">
    <label className="block">Preview theme<select value={theme} onChange={event => setTheme(event.target.value)} className="ml-3 rounded border border-border bg-background p-3"><option value="dark">Dark</option><option value="light">Light</option></select></label>
    <div role="region" data-theme={theme} className="space-y-3 rounded-xl border border-border bg-background p-5 text-foreground" aria-label="Theme preview">
      <h2 style={{ fontFamily: "var(--font-display)" }} className="text-2xl">Reading preview</h2>
      <p style={{ fontFamily: "var(--font-body)" }}>Theme colors and typography come from the canonical CSS tokens.</p>
      <p className="rounded bg-primary p-3 text-primary-foreground">Primary color</p><p className="rounded bg-muted p-3 text-muted-foreground">Muted text and surface</p>
    </div>
    <p className="text-sm text-muted-foreground">Preview changes affect this sample only and are not saved.</p>
    <label className="block">Search canonical token declarations<input value={query} onChange={event => setQuery(event.target.value)} className="mt-1 block w-full rounded border border-border bg-background p-3" /></label>
    <p className="text-sm">{filtered.length} declarations. Repeated names reflect light/dark overrides in source order.</p>
    <ul className="max-h-96 space-y-2 overflow-auto rounded-xl border border-border p-4">{filtered.map((token, index) => <li key={`${token.name}-${index}`} className="break-words border-b border-border py-2"><code>{token.name}</code><p className="break-all text-sm text-muted-foreground">{token.value}</p></li>)}</ul>
  </section>;
}
