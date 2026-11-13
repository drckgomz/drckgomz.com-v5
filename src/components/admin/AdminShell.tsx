"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

export const adminNavigation = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/posts", label: "Posts" },
  { href: "/admin/posts/new", label: "Create post" },
  { href: "/admin/media", label: "Media library" },
  { href: "/admin/home", label: "Homepage" },
  { href: "/admin/appearance", label: "Appearance" },
  { href: "/admin/navigation", label: "Public navigation" },
  { href: "/admin/settings", label: "Site settings" },
  { href: "/admin/bugs", label: "Bug reports" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/private-access", label: "Private journal access" },
  { href: "/admin/terminal/commands", label: "Terminal commands" },
] as const;

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = [...adminNavigation].reverse().find(({ href }) => pathname === href || (href !== "/admin" && pathname.startsWith(href + "/")));
  const isDetail = current && pathname !== current.href;
  const links = adminNavigation.map(({ href, label }) => {
    const active = current?.href === href;
    return <Link key={href} href={href} aria-current={active ? "page" : undefined}
      onClick={() => setOpen(false)}
      className={`block rounded-lg px-3 py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${active ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}>{label}</Link>;
  });
  return <div data-theme-scope="admin" data-theme="dark" className="min-h-screen bg-background text-foreground">
    <a href="#admin-content" className="sr-only focus:not-sr-only focus:block focus:p-3">Skip to admin content</a>
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4">
      <Link href="/admin" className="font-semibold">DRCKGOMZ / Administration</Link>
      <div className="flex items-center gap-4 text-sm"><Link href="/blog" className="underline underline-offset-4">View website</Link><Link href="/account" className="underline underline-offset-4">Account</Link></div>
    </header>
    <div className="mx-auto grid max-w-[1600px] md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="border-b border-border p-3 md:min-h-[calc(100vh-73px)] md:border-r md:border-b-0">
        <button type="button" className="w-full rounded-lg border border-border px-3 py-3 text-left md:hidden" aria-expanded={open} aria-controls="admin-mobile-navigation" onClick={() => setOpen(!open)}>Admin navigation {open ? "−" : "+"}</button>
        <nav aria-label="Administration" className="hidden space-y-1 md:block">{links}</nav>
        {open && <nav id="admin-mobile-navigation" aria-label="Mobile administration" className="mt-3 space-y-1 md:hidden" onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); document.querySelector<HTMLButtonElement>('[aria-controls="admin-mobile-navigation"]')?.focus(); } }}>{links}</nav>}
      </aside>
      <div className="min-w-0">
        <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 border-b border-border px-4 py-3 text-sm text-muted-foreground">
          <Link href="/admin" className="underline underline-offset-4">Admin</Link>
          {current && current.href !== "/admin" && <><span aria-hidden="true">/</span><Link href={current.href} className="underline underline-offset-4" aria-current={!isDetail ? "page" : undefined}>{current.label}</Link></>}
          {isDetail && <><span aria-hidden="true">/</span><span aria-current="page">{pathname.endsWith("/new") ? "Create" : "Editor"}</span></>}
        </nav>
        <div id="admin-content" tabIndex={-1} className="min-w-0 outline-none">{children}</div>
      </div>
    </div>
  </div>;
}
