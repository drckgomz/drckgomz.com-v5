import Link from "next/link";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { listOwnerPosts } from "@/lib/db/repositories/admin-posts";
import { isLocalPostgresIntegrationEnabled } from "@/lib/db/local-postgres-target";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const sections = [
  { href: "/admin/posts/new", title: "Create New Blog Post", description: "Create an unpublished private draft." },
  { href: "/admin/posts", title: "Manage Posts", description: "Review posts, edit content, and manage publication." },
  { href: "/admin/users", title: "Manage Users", description: "Management backend unavailable; restoration required." },
  { href: "/admin/home", title: "Manage Home", description: "Review effective configuration and backend availability." },
  { href: "/admin/projects", title: "Manage Projects", description: "Management backend unavailable; restoration required." },
  { href: "/admin/terminal/commands", title: "Manage Terminal Commands", description: "Registry backend unavailable; public commands currently come from the compiled allowlist." },
  { href: "/admin/bugs", title: "Bug Reports", description: "Check report-inbox backend availability." },
];

export default async function AdminPage() {
  const profile = await requireAdmin();
  let catalog: Awaited<ReturnType<typeof listOwnerPosts>> | null = null;
  let unavailable = "";
  if (profile.is_owner && isLocalPostgresIntegrationEnabled(process.env)) {
    try {
      catalog = await listOwnerPosts({ limit: 50, offset: 0, status: "all" });
    } catch {
      unavailable = "The post overview could not load. Open Posts to retry.";
    }
  } else unavailable = "The post overview requires the configured local owner account.";

  return <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6">
    <header className="space-y-2">
      <h1 className="text-3xl font-semibold">Admin Panel</h1>
      <p className="text-sm text-muted-foreground">Manage your website. Sections awaiting restoration are identified below.</p>
    </header>
    <section aria-labelledby="post-overview-heading" className="space-y-4 rounded-xl border border-border p-4">
      <h2 id="post-overview-heading" className="text-xl font-semibold">Post overview</h2>
      {unavailable && <p role="status">{unavailable}</p>}
      {catalog && <>
        <p>{catalog.hasMore ? "More than 50 posts. Counts below cover the 50 most recently updated." : `${catalog.posts.length} posts in the database.`}</p>
        <dl className="flex flex-wrap gap-6">
          {(["draft", "public", "private", "archived"] as const).map(status => <div key={status}>
            <dt className="capitalize text-muted-foreground">{status === "private" ? "Published private" : status === "public" ? "Published public" : status}</dt><dd className="text-2xl font-semibold">{catalog.posts.filter(post => post.status === status).length}</dd>
          </div>)}
        </dl>
        {catalog.posts.length === 0 ? <p>No posts yet. <Link className="underline" href="/admin/posts/new">Create your first draft</Link>.</p> : <ul className="space-y-2">
          {catalog.posts.slice(0, 5).map(post => <li key={post.id} className="flex flex-wrap justify-between gap-2 border-t border-border py-2">
            <Link href={`/admin/posts/${encodeURIComponent(post.slug)}`} className="min-w-0 break-words underline underline-offset-4">{post.title || post.slug}</Link>
            <span className="text-sm text-muted-foreground">{post.status}</span>
          </li>)}
        </ul>}
      </>}
    </section>
    <section aria-labelledby="management-heading" className="space-y-4">
      <h2 id="management-heading" className="text-xl font-semibold">Management sections</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map(section => <div key={section.href} className="space-y-2 rounded-xl border border-border p-4">
          <Link href={section.href} className="font-semibold underline underline-offset-4">{section.title}</Link>
          <p className="text-sm text-muted-foreground">{section.description}</p>
        </div>)}
      </div>
    </section>
  </main>;
}
