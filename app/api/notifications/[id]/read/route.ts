import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseRouteParams } from "@/lib/validation/http";
import { idParams } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

// POST /api/notifications/[id]/read
// Marks a single notification as read. RLS already restricts this to
// the recipient's own rows (user_id = auth.uid()).
export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const parsedParams = parseRouteParams(await props.params, idParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("workspace_notifications")
    .update({ is_read: true })
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
