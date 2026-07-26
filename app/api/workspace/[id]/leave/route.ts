import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity, WorkspaceActions } from "@/lib/workspace/activity-logger";
import { parseRouteParams } from "@/lib/validation/http";
import { idParams } from "@/lib/validation/schemas";
import type { WorkspaceRole } from "@/types";

export const dynamic = "force-dynamic";

// ── POST /api/workspace/[id]/leave ───────────────────────────
// Lets the current user leave a workspace they're a member of.
// Owners cannot leave their own workspace — they created it, so
// the only way out is to dismiss (delete) the whole workspace.
export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  // No body validation: the client POSTs this with no body at all.
  const parsedParams = parseRouteParams(await props.params, idParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("id, role")
    .eq("workspace_id", params.id)
    .eq("user_id", user.id)
    .single();

  if (membershipError || !membership) {
    return NextResponse.json({ error: "You are not a member of this workspace." }, { status: 404 });
  }

  const role = membership.role as WorkspaceRole;
  if (role === "owner") {
    return NextResponse.json(
      { error: "As the owner, you can't leave this workspace. You can dismiss (delete) it instead." },
      { status: 403 }
    );
  }

  const { error: deleteError } = await supabase
    .from("workspace_members")
    .delete()
    .eq("id", membership.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Best-effort activity log — may fail silently if RLS no longer
  // allows the now-departed member to write to this workspace's log,
  // which is fine.
  try {
    await logActivity(supabase, params.id, user.id, WorkspaceActions.MEMBER_REMOVED, {
      metadata: { self_initiated: true },
    });
  } catch {
    // ignore
  }

  return NextResponse.json({ success: true });
}
