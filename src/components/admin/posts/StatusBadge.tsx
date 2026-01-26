// src/components/blog/admin/posts/StatusBadge.tsx
import type { Post } from "./types";

export default function StatusBadge({ status }: { status: Post["status"] }) {
  const label =
    status === "public"
      ? "Public"
      : status === "private"
      ? "Private"
      : status === "archived"
      ? "Archived"
      : "Draft";

  const style =
    status === "public"
      ? "bg-emerald-600/20 text-emerald-300 ring-1 ring-emerald-600/40"
      : status === "private"
      ? "bg-blue-600/20 text-blue-300 ring-1 ring-blue-600/40"
      : status === "archived"
      ? "bg-amber-600/20 text-amber-300 ring-1 ring-amber-600/40"
      : "bg-gray-600/20 text-gray-300 ring-1 ring-gray-600/40";

  return (
    <span
      className={[
        "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        style,
      ].join(" ")}
    >
      {label}
    </span>
  );
}
