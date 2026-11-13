import { randomUUID } from "crypto";
import { readUploadForm, validateImageBytes, UploadInputError } from "@/lib/cms/upload";
// src/app/api/admin/posts/[slug]/media/upload/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApi } from "@/lib/admin/requireAdminApi";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { makePrivateJournalKey, privateMediaUrl, privateJournalStorageConfig } from "@/lib/blog/private-media";

const POSTS_TABLE = "posts";
const MEDIA_TABLE = "media";

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getS3() {
  const config = privateJournalStorageConfig();
  if (!config) throw new Error("Private journal media storage is not configured.");
  // Credentials are read automatically from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
  // or from the environment where you run (IAM role, etc.)
  return {
    bucket: config.bucket,
    client: new S3Client({ region: config.region }),
  };
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const { slug } = await ctx.params;
    const slugParam = slug;

    const supabase = getSupabaseAdmin();

    // Blog media is always stored privately. Public blog rendering can use the
    // protected route after publication; portfolio uploads retain their path.
    const { data: post, error: postErr } = await supabase
      .from(POSTS_TABLE)
      .select("id")
      .eq("slug", slugParam)
      .maybeSingle();

    if (postErr) return NextResponse.json({ error: "Post lookup failed." }, { status: 500 });
    if (!post?.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const form = await readUploadForm(request);
    const file = form.get("file");
    if (!(file instanceof File) || form.getAll("file").length !== 1) {
      throw new UploadInputError("Expected exactly one image file.");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const extension = validateImageBytes(bytes, file.type);
    const mediaId = randomUUID();

    // next idx
    const { data: last, error: lastErr } = await supabase
      .from(MEDIA_TABLE)
      .select("idx")
      .eq("post_id", post.id)
      .order("idx", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastErr) return NextResponse.json({ error: "Media order lookup failed." }, { status: 500 });

    const nextIdx = typeof last?.idx === "number" ? last.idx + 1 : 0;

    // upload to s3
    const { client: s3, bucket } = getS3();
    const key = makePrivateJournalKey(String(post.id), mediaId, extension);
    if (!key) {
      s3.destroy();
      return NextResponse.json({ error: "Post identifier cannot be used for private media." }, { status: 409 });
    }

    try { await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bytes,
        ContentType: file.type || "application/octet-stream",
        CacheControl: "private, no-store, max-age=0",
        // NOTE: Do NOT set ACL unless your bucket specifically allows it.
        // Most modern buckets use "Bucket owner enforced" and ignore ACLs.
      })
    ); } finally { s3.destroy(); }

    // store the S3 key in DB (NOT a local /uploads path)
    const { data: created, error: insErr } = await supabase
      .from(MEDIA_TABLE)
      .insert({
        id: mediaId,
        post_id: post.id,
        type: "image",
        url: key, // e.g. "blog-images/<postId>/<filename>"
        caption: null,
        idx: nextIdx,
      })
      .select("id,type,url,caption,idx,post_id")
      .single();

    if (insErr) return NextResponse.json({ error: "Media record could not be saved; private storage may contain an unlinked object." }, { status: 500 });

    return NextResponse.json({ media: { ...created, url: privateMediaUrl(mediaId) } }, { status: 201 });
  } catch (error) {
    if (error instanceof UploadInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Image upload failed. Retry after checking the media list." }, { status: 500 });
  }
}
