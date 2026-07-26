import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity, WorkspaceActions } from "@/lib/workspace/activity-logger";
import { z } from "zod";
import { parseJsonBody, parseRouteParams } from "@/lib/validation/http";
import { idParams, uuid } from "@/lib/validation/schemas";
import type { WorkspaceRole } from "@/types";

export const dynamic = "force-dynamic";

/** `targetUserId` is an auth.users UUID, matched against workspace_members.user_id. */
const TransferOwnershipBody = z.object({
  targetUserId: uuid,
});

// ── POST /api/workspace/[id]/transfer ───────────────────────
// Transfer ownership to another member (owner only)
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const parsedParams = parseRouteParams(await props.params, idParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const admin    = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Must be current owner
  const { data: currentMember } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", params.id)
    .eq("user_id", user.id)
    .single();

  if (currentMember?.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can transfer ownership." }, { status: 403 });
  }

  const parsed = await parseJsonBody(req, TransferOwnershipBody);
  if (!parsed.success) return parsed.response;
  const { targetUserId } = parsed.data;

  if (targetUserId === user.id) {
    return NextResponse.json({ error: "You are already the owner." }, { status: 400 });
  }

  // Target must be an existing member
  const { data: targetMember } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", params.id)
    .eq("user_id", targetUserId)
    .single();

  if (!targetMember) {
    return NextResponse.json({ error: "Target user is not a member of this workspace." }, { status: 404 });
  }

  // Swap roles: current owner → manager, target → owner
  const { error: e1 } = await supabase
    .from("workspace_members")
    .update({ role: "manager" as WorkspaceRole })
    .eq("workspace_id", params.id)
    .eq("user_id", user.id);

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

  const { error: e2 } = await supabase
    .from("workspace_members")
    .update({ role: "owner" as WorkspaceRole })
    .eq("workspace_id", params.id)
    .eq("user_id", targetUserId);

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  // Update workspaces.owner_id
  await supabase
    .from("workspaces")
    .update({ owner_id: targetUserId, updated_at: new Date().toISOString() })
    .eq("id", params.id);

  // Log activity
  const { data: actorData }  = await admin.auth.admin.getUserById(user.id);
  const { data: targetData } = await admin.auth.admin.getUserById(targetUserId);
  const actorName  = actorData?.user?.user_metadata?.full_name  || actorData?.user?.email  || "Unknown";
  const targetName = targetData?.user?.user_metadata?.full_name || targetData?.user?.email || "Unknown";

  await logActivity(supabase, params.id, user.id, WorkspaceActions.OWNERSHIP_TRANSFERRED, {
    metadata: { user_name: actorName, target_name: targetName },
  });

  return NextResponse.json({ success: true });
}
