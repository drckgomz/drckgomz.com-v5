// src/app/api/admin/uploads/presign/route.ts
import "server-only";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/requireAdminApi";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function safeFilename(name: string) {
  return name.replace(/[^\w.\-]+/g, "-");
}


export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  try {
    const body = await req.json().catch(() => ({}));

    const scope = String(body?.scope || "");
    const projectId = String(body?.projectId || "");
    const filename = safeFilename(String(body?.filename || "upload.bin"));
    const contentType = String(body?.contentType || "application/octet-stream");

    if (scope !== "projects") {
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
    }
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const region = mustEnv("AWS_REGION");
    const bucket = mustEnv("S3_BUCKET").trim(); // trim helps if you accidentally have a trailing space

    const s3 = new S3Client({
      region,
      credentials: {
        accessKeyId: mustEnv("AWS_ACCESS_KEY_ID"),
        secretAccessKey: mustEnv("AWS_SECRET_ACCESS_KEY"),
      },
    });

    const uuid = crypto.randomUUID();
    const key = `projects/${projectId}/${uuid}-${filename}`;

    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 });
    return NextResponse.json({ url, key });
  } catch (err: any) {
    console.error("PRESIGN_ERROR:", err);
    return NextResponse.json(
      {
        error: err?.message || String(err),
        name: err?.name,
        stack: process.env.NODE_ENV === "development" ? err?.stack : undefined,
      },
      { status: 500 }
    );
  }

}

