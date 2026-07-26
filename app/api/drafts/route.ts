import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseJsonBody } from "@/lib/validation/http";
import { httpUrl, platformId } from "@/lib/validation/schemas";

/**
 * Every field is optional because the handler already defaults each one
 * (`title || ""`, `media_urls || []`) — a draft with nothing filled in is a
 * legitimate save from Compose. `title`/`description` are plain optional
 * strings rather than `optionalString()`: both columns are
 * `text NOT NULL DEFAULT ''`, so "" is a real value that clears the field.
 */
const DraftBody = z.object({
  title: z.string().trim().max(500, "Must be 500 characters or fewer.").optional(),
  description: z.string().trim().max(20_000, "Must be 20000 characters or fewer.").optional(),
  media_urls: z.array(httpUrl.max(2_048, "Must be 2048 characters or fewer.")).max(20, "At most 20 media items.").optional(),
  platforms: z.array(platformId).max(20, "Too many platforms.").optional(),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("drafts")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drafts: data });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await parseJsonBody(req, DraftBody);
  if (!parsed.success) return parsed.response;
  const { title, description, media_urls, platforms } = parsed.data;

  const { data, error } = await supabase
    .from("drafts")
    .insert({
      user_id: user.id,
      title: title || "",
      description: description || "",
      media_urls: media_urls || [],
      platforms: platforms || [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draft: data });
}
