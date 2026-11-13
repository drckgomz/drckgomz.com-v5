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

  const style = "bg-secondary text-secondary-foreground ring-1 ring-border";

  return (
    <span
      className={[
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wide",
        style,
      ].join(" ")}
    >
      {label}
    </span>
  );
}
