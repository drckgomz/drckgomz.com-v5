import ReloadStatus from "./ReloadStatus";
import type { ReactNode } from "react";

export default function ManagementPage({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
    <header className="space-y-2"><h1 className="text-3xl font-semibold">{title}</h1><p className="text-muted-foreground">{description}</p></header>
    {children}
  </main>;
}

export function Unavailable({ children }: { children: ReactNode }) {
  return <section role="status" className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
    <h2 className="text-lg font-semibold">Management unavailable</h2><p className="text-sm">{children}</p>
  </section>;
}

export { ReloadStatus };
