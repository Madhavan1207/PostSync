import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseJsonBody, parseRouteParams } from "@/lib/validation/http";
import { httpUrl, idParams, platformId } from "@/lib/validation/schemas";

/**
 * A PATCH may carry any subset of fields — the handler maps a missing field to
 * `undefined` so Supabase leaves that column alone. `title`/`description` stay
 * plain optional strings (not `optionalString()`) because both columns are
 * `text NOT NULL DEFAULT ''` and "" must survive as a way to clear them.
 */
const UpdateDraftBody = z.object({
  title: z.string().trim().max(500, "Must be 500 characters or fewer.").optional(),
  description: z.string().trim().max(20_000, "Must be 20000 characters or fewer.").optional(),
  media_urls: z.array(httpUrl.max(2_048, "Must be 2048 characters or fewer.")).max(20, "At most 20 media items.").optional(),
  platforms: z.array(platformId).max(20, "Too many platforms.").optional(),
});

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const parsedParams = parseRouteParams(await props.params, idParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await parseJsonBody(req, UpdateDraftBody);
  if (!parsed.success) return parsed.response;
  const { title, description, media_urls, platforms } = parsed.data;

  const { data, error } = await supabase
    .from("drafts")
    .update({
      title: title ?? undefined,
      description: description ?? undefined,
      media_urls: media_urls ?? undefined,
      platforms: platforms ?? undefined,
    })
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draft: data });
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const parsedParams = parseRouteParams(await props.params, idParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("drafts")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
