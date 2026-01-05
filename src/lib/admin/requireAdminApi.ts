// src/lib/admin/requireAdminApi.ts
import "server-only";
import { NextResponse } from "next/server";
import { getUserProfile } from "@/lib/profile/getUserProfile";

export async function requireAdminApi() {
  let profile = null;

  try {
    profile = await getUserProfile();
  } catch (err) {
    console.error("[requireAdminApi] getUserProfile threw:", err);
    return NextResponse.json({ error: "Auth check failed" }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (profile.role?.toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}
