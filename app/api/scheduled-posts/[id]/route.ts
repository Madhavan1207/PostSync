import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseJsonBody, parseRouteParams } from "@/lib/validation/http";
import { idParams, isoDateTime, scheduledPostStatus } from "@/lib/validation/schemas";

/**
 * An explicit allowlist, because the parsed body is handed straight to
 * `.update()`. Without one, any authenticated caller could set arbitrary
 * columns on their own row — including `user_id`, which is matched against the
 * pre-update value and would hand the row to someone else.
 *
 * The Calendar is the only caller: it sends `{ status }` (cancel / mark
 * published) or `{ scheduled_time }` (reschedule), never both, so both fields
 * are optional. Unknown keys are stripped rather than rejected, matching the
 * previous tolerance for extra properties.
 */
const UpdateScheduledPostBody = z.object({
  status: scheduledPostStatus.optional(),
  scheduled_time: isoDateTime.optional(),
});

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const parsedParams = parseRouteParams(await props.params, idParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await parseJsonBody(req, UpdateScheduledPostBody);
  if (!parsed.success) return parsed.response;

  const { data, error } = await supabase
    .from("scheduled_posts")
    .update(parsed.data)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .is("workspace_id", null)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: data });
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const parsedParams = parseRouteParams(await props.params, idParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("scheduled_posts")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id)
    .is("workspace_id", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
