// src/app/admin/page.tsx
import Link from "next/link";
import { requireAdmin } from "@/lib/profile/requireAdmin";

const baseBtn =
  "block w-full px-6 py-4 rounded-lg text-center font-semibold text-white " +
  "transition-shadow duration-200 hover:opacity-95 active:opacity-90 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black";
const glow = "hover:shadow-[0_0_18px_var(--glow)]";

const COLORS = {
  amber: "#CC8F00",
  orange: "#D95A00",
  magenta: "#99125C",
  violet: "#4E188F",
  azure: "#005F99",
  emerald: "#008F66",
  maroon: "#7A1028",
  slate: "#1f2937",
};

function AdminLinks() {
  return (
    <div className="w-full space-y-4 mt-8">
      <div className="w-full space-y-6">
        <Link
          href="/admin/posts/new"
          className={`${baseBtn} ${glow}`}
          style={{
            backgroundColor: COLORS.amber,
            ["--glow" as any]: "rgba(200,16,46,.45)",
          }}
        >
          Create New Blog Post
        </Link>
      </div>

      <Link
        href="/admin/users"
        className={`${baseBtn} ${glow}`}
        style={{
          backgroundColor: COLORS.orange,
          ["--glow" as any]: "rgba(59,35,106,.45)",
        }}
      >
        Manage Users
      </Link>

      <Link
        href="/admin/posts"
        className={`${baseBtn} ${glow}`}
        style={{
          backgroundColor: COLORS.magenta,
          ["--glow" as any]: "rgba(10,122,165,.45)",
        }}
      >
        Manage Posts
      </Link>

      <Link
        href="/admin/home"
        className={`${baseBtn} ${glow}`}
        style={{
          backgroundColor: COLORS.violet,
          ["--glow" as any]: "rgba(0,160,96,.45)",
        }}
      >
        Manage Home
      </Link>

      <Link
        href="/admin/projects"
        className={`${baseBtn} ${glow}`}
        style={{
          backgroundColor: COLORS.azure,
          ["--glow" as any]: "rgba(226,28,141,.48)",
        }}
      >
        Manage Projects
      </Link>

      <Link
        href="/admin/terminal/commands"
        className={`${baseBtn} ${glow}`}
        style={{
          backgroundColor: COLORS.emerald,
          ["--glow" as any]: "rgba(51,65,85,.35)",
        }}
      >
        Manage Terminal Commands
      </Link>

      <Link
        href="/admin/bugs"
        className={`${baseBtn} ${glow}`}
        style={{
          backgroundColor: COLORS.maroon,
          ["--glow" as any]: "rgba(51,65,85,.35)",
        }}
      >
        Bug Reports
      </Link>

      <div className="flex justify-center">
        <Link
          href="/blog"
          className={`mt-4 px-6 py-2 rounded-lg font-semibold text-white ${glow}`}
          style={{
            backgroundColor: COLORS.slate,
            ["--glow" as any]: "rgba(51,65,85,.35)",
          }}
        >
          ← Back
        </Link>
      </div>
    </div>
  );
}

export default async function AdminPage() {
  const { profile, isAdmin } = await requireAdmin();

  return (
    <div className="w-full max-w-3xl mx-auto px-6 pb-16">
      <h1 className="text-4xl font-bold py-2 mt-16 text-center">Admin Panel</h1>

      {!isAdmin ? (
        <div className="mt-12 text-center text-white/80">
          <p className="text-xl font-semibold">403 — Admins only</p>
          <p className="mt-2">
            Signed in as{" "}
            <span className="font-semibold text-white">{profile.email}</span>
          </p>
          <p className="mt-2">You don’t have permission to access the admin panel.</p>
          <div className="mt-6">
            <Link
              href="/blog"
              className={`px-6 py-2 rounded-lg font-semibold text-white ${glow}`}
              style={{
                backgroundColor: COLORS.slate,
                ["--glow" as any]: "rgba(51,65,85,.35)",
              }}
            >
              ← Back to Blog
            </Link>
          </div>
        </div>
      ) : (
        <AdminLinks />
      )}
    </div>
  );
}

