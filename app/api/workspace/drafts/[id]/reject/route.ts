import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity, WorkspaceActions } from "@/lib/workspace/activity-logger";
import { canApprove } from "@/lib/workspace/permissions";
import { z } from "zod";
import { parseJsonBody, parseRouteParams } from "@/lib/validation/http";
import { idParams, nonEmptyString } from "@/lib/validation/schemas";
import type { WorkspaceRole } from "@/types";

export const dynamic = "force-dynamic";

/**
 * `reason` is required — the handler already rejected a blank one with a 400,
 * and it is the only record of *why* a draft came back to its creator.
 */
const RejectDraftBody = z.object({
  reason: nonEmptyString(2_000),
});

// ── POST /api/workspace/drafts/[id]/reject ───────────────────
// Manager/Owner rejects a pending draft with a reason
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
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
    return NextResponse.json({ error: "Only managers and owners can reject drafts." }, { status: 403 });
  }

  const parsed = await parseJsonBody(req, RejectDraftBody);
  if (!parsed.success) return parsed.response;
  const { reason } = parsed.data;

  const { data: draft } = await supabase
    .from("workspace_drafts")
    .select("*")
    .eq("id", params.id)
    .eq("workspace_id", membership.workspace_id)
    .single();

  if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });

  if (draft.status !== "pending_approval") {
    return NextResponse.json({ error: "Only pending drafts can be rejected." }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("workspace_drafts")
    .update({
      status:           "rejected",
      reviewed_by:      user.id,
      reviewed_at:      new Date().toISOString(),
      rejection_reason: reason,
      updated_at:       new Date().toISOString(),
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: userData } = await admin.auth.admin.getUserById(user.id);
  const userName = userData?.user?.user_metadata?.full_name || userData?.user?.email || "Unknown";
  await logActivity(supabase, membership.workspace_id, user.id, WorkspaceActions.DRAFT_REJECTED, {
    entityType: "workspace_draft",
    entityId:   params.id,
    metadata:   { user_name: userName, target_name: draft.title, reason },
  });

  return NextResponse.json({ draft: updated });
}
