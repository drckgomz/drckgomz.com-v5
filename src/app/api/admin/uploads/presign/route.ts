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
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(projectId)) {
      return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
    }

    if (filename.length > 240 || !["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "video/mp4", "video/webm", "video/quicktime", "application/pdf", "text/plain", "application/octet-stream"].includes(contentType)) {
      return NextResponse.json({ error: "Unsupported upload type or filename." }, { status: 400 });
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
      ...(!contentType.startsWith("image/") && !contentType.startsWith("video/") ? { ContentDisposition: "attachment" } : {}),
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 });
    return NextResponse.json({ url, key });
  } catch {
    return NextResponse.json({ error: "Upload authorization failed." }, { status: 500 });
  }
}
