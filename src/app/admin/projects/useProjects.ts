// src/app/admin/projects/useProjects.ts
"use client";

import * as React from "react";
import type { Project, Tab, ProjectStatus } from "./types";

const API_BASE = "/api/admin/projects";

function normalizeStatus(s: any): ProjectStatus {
  if (s === "public") return "public";
  // treat anything else (draft/private/unknown) as draft in the admin UI
  return "draft";
}

export function useProjects() {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [tab, setTab] = React.useState<Tab>("all");
  const [q, setQ] = React.useState("");

  const fetchProjects = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (tab !== "all") qs.set("status", tab);

      const res = await fetch(`${API_BASE}?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());

      const json = await res.json().catch(() => ({}));
      const listRaw: any[] = json.projects ?? json.data ?? [];

      const list: Project[] = listRaw.map((p) => ({
        id: String(p.id),
        title: p.title ?? null,
        slug: p.slug ?? null,
        excerpt: p.excerpt ?? null,
        href: p.href ?? null,
        image_url: p.image_url ?? null,
        updated_at: p.updated_at ?? null,
        status: normalizeStatus(p.status),
      }));

      setProjects(list);
    } catch (e: any) {
      setError(e?.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  React.useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const filtered = React.useMemo(() => {
    let list = projects;

    if (tab !== "all") list = list.filter((p) => p.status === tab);

    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter((p) => {
        const title = (p.title ?? "").toLowerCase();
        const slug = (p.slug ?? "").toLowerCase();
        const excerpt = (p.excerpt ?? "").toLowerCase();
        return title.includes(s) || slug.includes(s) || excerpt.includes(s);
      });
    }

    return list;
  }, [projects, tab, q]);

  const patch = async (id: string, body: Record<string, any>) => {
    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchProjects();
    } catch (e: any) {
      alert(e?.message || "Failed to update project");
    }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this project?")) return;
    const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
    if (!res.ok) return alert(await res.text());
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const setStatus = (id: string, status: ProjectStatus) => patch(id, { status });

  return {
    projects,
    filtered,
    loading,
    error,
    tab,
    setTab,
    q,
    setQ,
    fetchProjects,
    setStatus,
    del,
  };
}
