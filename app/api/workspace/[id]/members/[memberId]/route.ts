import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity, WorkspaceActions } from "@/lib/workspace/activity-logger";
import { z } from "zod";
import { canManageMembers, canChangeRoles } from "@/lib/workspace/permissions";
import { parseJsonBody, parseRouteParams } from "@/lib/validation/http";
import { uuid, workspaceRole } from "@/lib/validation/schemas";
import type { WorkspaceRole } from "@/types";

export const dynamic = "force-dynamic";

const MemberParams = z.object({ id: uuid, memberId: uuid });

/** `owner` is excluded — ownership only moves via the transfer route. */
const UpdateMemberRoleBody = z.object({
  role: workspaceRole.exclude(["owner"]),
});

async function getUserRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  userId: string
): Promise<WorkspaceRole | null> {
  const { data } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .single();
  return (data?.role as WorkspaceRole) ?? null;
}

// ── PATCH /api/workspace/[id]/members/[memberId] ─────────────
// Change a member's role (owner only)
export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string; memberId: string }> }
) {
  const parsedParams = parseRouteParams(await props.params, MemberParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const admin    = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getUserRole(supabase, params.id, user.id);
  if (!role || !canChangeRoles(role)) {
    return NextResponse.json({ error: "Only the workspace owner can change roles." }, { status: 403 });
  }

  const parsed = await parseJsonBody(req, UpdateMemberRoleBody);
  if (!parsed.success) return parsed.response;
  const { role: newRole } = parsed.data;

  // Get the target member
  const { data: targetMember, error: fetchError } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("id", params.memberId)
    .eq("workspace_id", params.id)
    .single();

  if (fetchError || !targetMember) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  // Cannot change owner's role
  if (targetMember.role === "owner") {
    return NextResponse.json({ error: "Cannot change the owner's role. Transfer ownership first." }, { status: 400 });
  }

  // Cannot change your own role
  if (targetMember.user_id === user.id) {
    return NextResponse.json({ error: "You cannot change your own role." }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("workspace_members")
    .update({ role: newRole })
    .eq("id", params.memberId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log activity
  const { data: actorData }  = await admin.auth.admin.getUserById(user.id);
  const { data: targetData } = await admin.auth.admin.getUserById(targetMember.user_id);
  const actorName  = actorData?.user?.user_metadata?.full_name  || actorData?.user?.email  || "Unknown";
  const targetName = targetData?.user?.user_metadata?.full_name || targetData?.user?.email || "Unknown";

  await logActivity(supabase, params.id, user.id, WorkspaceActions.ROLE_CHANGED, {
    entityType: "member",
    entityId:   params.memberId,
    metadata:   { user_name: actorName, target_name: targetName, new_role: newRole },
  });

  return NextResponse.json({ member: updated });
}

// ── DELETE /api/workspace/[id]/members/[memberId] ────────────
// Remove a member from the workspace (owner only)
export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string; memberId: string }> }
) {
  const parsedParams = parseRouteParams(await props.params, MemberParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const admin    = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getUserRole(supabase, params.id, user.id);
  if (!role || !canManageMembers(role)) {
    return NextResponse.json({ error: "Only the workspace owner can remove members." }, { status: 403 });
  }

  // Get target member
  const { data: targetMember, error: fetchError } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("id", params.memberId)
    .eq("workspace_id", params.id)
    .single();

  if (fetchError || !targetMember) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  // Cannot remove owner
  if (targetMember.role === "owner") {
    return NextResponse.json({ error: "Cannot remove the workspace owner." }, { status: 400 });
  }

  // Cannot remove yourself
  if (targetMember.user_id === user.id) {
    return NextResponse.json({ error: "You cannot remove yourself. Delete the workspace instead." }, { status: 400 });
  }

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("id", params.memberId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log activity
  const { data: actorData }  = await admin.auth.admin.getUserById(user.id);
  const { data: targetData } = await admin.auth.admin.getUserById(targetMember.user_id);
  const actorName  = actorData?.user?.user_metadata?.full_name  || actorData?.user?.email  || "Unknown";
  const targetName = targetData?.user?.user_metadata?.full_name || targetData?.user?.email || "Unknown";

  await logActivity(supabase, params.id, user.id, WorkspaceActions.MEMBER_REMOVED, {
    entityType: "member",
    entityId:   params.memberId,
    metadata:   { user_name: actorName, target_name: targetName },
  });

  return NextResponse.json({ success: true });
}
