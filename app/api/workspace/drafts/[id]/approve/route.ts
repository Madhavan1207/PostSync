import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity, WorkspaceActions } from "@/lib/workspace/activity-logger";
import { canApprove } from "@/lib/workspace/permissions";
import { parseRouteParams } from "@/lib/validation/http";
import { idParams } from "@/lib/validation/schemas";
import type { WorkspaceRole } from "@/types";

export const dynamic = "force-dynamic";

// ── POST /api/workspace/drafts/[id]/approve ──────────────────
// Manager/Owner approves a pending draft
export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const parsedParams = parseRouteParams(await props.params, idParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const admin    = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!membership) return NextResponse.json({ error: "Not in a workspace." }, { status: 403 });

  if (!canApprove(membership.role as WorkspaceRole)) {
    return NextResponse.json({ error: "Only managers and owners can approve drafts." }, { status: 403 });
  }

  const { data: draft } = await supabase
    .from("workspace_drafts")
    .select("*")
    .eq("id", params.id)
    .eq("workspace_id", membership.workspace_id)
    .single();

  if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });

  if (draft.status !== "pending_approval") {
    return NextResponse.json({ error: "Only pending drafts can be approved." }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("workspace_drafts")
    .update({
      status:      "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
      updated_at:  new Date().toISOString(),
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: userData } = await admin.auth.admin.getUserById(user.id);
  const userName = userData?.user?.user_metadata?.full_name || userData?.user?.email || "Unknown";
  await logActivity(supabase, membership.workspace_id, user.id, WorkspaceActions.DRAFT_APPROVED, {
    entityType: "workspace_draft",
    entityId:   params.id,
    metadata:   { user_name: userName, target_name: draft.title },
  });

  return NextResponse.json({ draft: updated });
}
