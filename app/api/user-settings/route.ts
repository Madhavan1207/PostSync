import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseJsonBody } from "@/lib/validation/http";
import { platformId } from "@/lib/validation/schemas";

/**
 * A strict allowlist of writable columns, because the parsed body is spread into
 * `.upsert({ user_id: user.id, ...body })`. Previously any key in the body
 * reached that spread, and because the spread came *after* `user_id`, a body
 * carrying its own `user_id` would overwrite it and write settings onto another
 * account's row. Unknown keys are now dropped by zod before the spread.
 *
 * `default_platforms` is the only field any caller sends, and it is optional so
 * that a partial save never clears anything it did not mention.
 */
const UpdateUserSettingsBody = z.object({
  default_platforms: z.array(platformId).max(20).optional(),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data || {} });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await parseJsonBody(req, UpdateUserSettingsBody);
  if (!parsed.success) return parsed.response;

  const { data, error } = await supabase
    .from("user_settings")
    .upsert({ ...parsed.data, user_id: user.id }, { onConflict: "user_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}