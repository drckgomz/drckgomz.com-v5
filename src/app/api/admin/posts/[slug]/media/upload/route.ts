// src/app/api/admin/posts/[slug]/media/upload/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApi } from "@/lib/admin/requireAdminApi";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const POSTS_TABLE = "posts";
const MEDIA_TABLE = "media";

// store keys like: blog-images/<postId>/<filename>
const S3_PREFIX = process.env.S3_MEDIA_PREFIX || "blog-images";

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getS3() {
  const region = process.env.AWS_REGION || "us-east-1";
  const bucket = process.env.S3_BUCKET;

  if (!bucket) throw new Error("Missing S3_BUCKET env.");
  // Credentials are read automatically from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
  // or from the environment where you run (IAM role, etc.)
  return {
    bucket,
    client: new S3Client({ region }),
  };
}

function safeFilename(name: string) {
  return String(name || "upload")
    .replaceAll(" ", "_")
    .replace(/[^\w.\-()]+/g, "_");
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const { slug } = await ctx.params;
  const slugParam = decodeURIComponent(slug);

  const supabase = getSupabaseAdmin();

  // find post id by slug
  const { data: post, error: postErr } = await supabase
    .from(POSTS_TABLE)
    .select("id")
    .eq("slug", slugParam)
    .maybeSingle();

  if (postErr) return NextResponse.json({ error: postErr.message }, { status: 500 });
  if (!post?.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // read file
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Expected multipart/form-data with `file`" },
      { status: 400 }
    );
  }
  if (!file.type?.startsWith("image/")) {
    return NextResponse.json({ error: "Only image uploads are supported." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = `${Date.now()}-${safeFilename(file.name)}`;

  // upload to s3
  const { client: s3, bucket } = getS3();
  const key = `${S3_PREFIX.replace(/\/+$/, "")}/${post.id}/${filename}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bytes,
      ContentType: file.type || "application/octet-stream",
      CacheControl: "public, max-age=31536000, immutable",
      // NOTE: Do NOT set ACL unless your bucket specifically allows it.
      // Most modern buckets use "Bucket owner enforced" and ignore ACLs.
    })
  );

  // next idx
  const { data: last } = await supabase
    .from(MEDIA_TABLE)
    .select("idx")
    .eq("post_id", post.id)
    .order("idx", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextIdx = typeof last?.idx === "number" ? last.idx + 1 : 0;

  // store the S3 key in DB (NOT a local /uploads path)
  const { data: created, error: insErr } = await supabase
    .from(MEDIA_TABLE)
    .insert({
      post_id: post.id,
      type: "image",
      url: key, // ✅ e.g. "blog-images/<postId>/<filename>"
      caption: null,
      idx: nextIdx,
    })
    .select("id,type,url,caption,idx,post_id")
    .single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ media: created }, { status: 201 });
}
