import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createBaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const maxDuration = 60; // Allow 60 seconds execution time for large video uploads

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB max limit
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/gif",
  "image/webp", "image/svg+xml",
  "video/mp4", "video/quicktime", "video/webm", "video/x-msvideo",
]);

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createBaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("media_library")
    .select("*")
    .eq("user_id", user.id)
    .order("uploaded_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = req.headers.get("content-type") || "";

  // Direct JSON Metadata Registration (Bypasses Next.js 413 Payload Limit for client-side uploads)
  if (contentType.includes("application/json")) {
    const json = await req.json().catch(() => ({}));
    const { file_name, file_url, file_type, file_size, content_hash } = json;

    if (!file_url || !file_name) {
      return NextResponse.json({ error: "Missing required media fields." }, { status: 400 });
    }

    const adminDbClient = getAdminClient() || supabase;

    // Fast Deduplication Check by file_name and file_size
    if (file_name && file_size) {
      const { data: existingByName } = await adminDbClient
        .from("media_library")
        .select("*")
        .eq("user_id", user.id)
        .eq("file_name", file_name)
        .eq("file_size", file_size)
        .limit(1)
        .maybeSingle();

      if (existingByName) {
        return NextResponse.json({ item: existingByName, deduplicated: true });
      }
    }

    const { data: mediaItem, error: dbError } = await adminDbClient
      .from("media_library")
      .insert({
        user_id: user.id,
        file_name,
        file_url,
        file_type: file_type || "image",
        file_size: file_size || 0,
        content_hash: content_hash || null,
      })
      .select()
      .single();

    if (dbError) {
      console.error("[Media Library JSON] DB Insert Error:", dbError.message);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ item: mediaItem });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "File is larger than 100MB." }, { status: 413 });
  if (!ALLOWED_MIME_TYPES.has(file.type)) return NextResponse.json({ error: "Unsupported file type." }, { status: 415 });

  // --- Deduplication: compute SHA-256 hash of file content ---
  const bytes = await file.arrayBuffer();
  const hash = createHash("sha256").update(Buffer.from(bytes)).digest("hex");

  // Check if this exact file already exists for this user
  const { data: existing } = await supabase
    .from("media_library")
    .select("*")
    .eq("user_id", user.id)
    .eq("content_hash", hash)
    .maybeSingle();

  if (existing) {
    // Return existing item — no duplicate stored
    return NextResponse.json({ item: existing, deduplicated: true });
  }

  const fileType = file.type.startsWith("video/") ? "video" : "image";
  const fileExt = file.name.split(".").pop() || "bin";
  const storagePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

  // Try standard user client upload first
  let storagePathResult = storagePath;
  let publicUrlResult = "";

  let { data: storageData, error: storageError } = await supabase.storage
    .from("media-library")
    .upload(storagePath, bytes, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: true,
    });

  // Fallback to Admin Service Role Client if standard upload fails (e.g. storage RLS restriction)
  if (storageError) {
    console.warn("[Media Upload] User storage client upload failed, attempting admin fallback:", storageError.message);
    const adminClient = getAdminClient();
    if (adminClient) {
      const adminRes = await adminClient.storage
        .from("media-library")
        .upload(storagePath, bytes, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: true,
        });

      if (adminRes.error) {
        console.error("[Media Upload] Admin storage client upload also failed:", adminRes.error.message);
        return NextResponse.json({ error: `Storage upload failed: ${adminRes.error.message}` }, { status: 500 });
      }
      storageData = adminRes.data;
      storageError = null;
    } else {
      return NextResponse.json({ error: `Storage upload failed: ${storageError.message}` }, { status: 500 });
    }
  }

  storagePathResult = storageData?.path || storagePath;
  const publicUrlRes = supabase.storage.from("media-library").getPublicUrl(storagePathResult);
  publicUrlResult = publicUrlRes.data.publicUrl;

  const adminDbClient = getAdminClient() || supabase;
  const { data: mediaItem, error: dbError } = await adminDbClient
    .from("media_library")
    .insert({
      user_id: user.id,
      file_name: file.name,
      file_url: publicUrlResult,
      file_type: fileType,
      file_size: file.size,
      content_hash: hash,
    })
    .select()
    .single();

  if (dbError) {
    console.error("[Media Upload] Database insert error:", dbError.message);
    const cleanupClient = getAdminClient() || supabase;
    await cleanupClient.storage.from("media-library").remove([storagePathResult]);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ item: mediaItem });
}
