import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity, WorkspaceActions } from "@/lib/workspace/activity-logger";
import { canManageSubmittedReports } from "@/lib/workspace/permissions";
import { getMemberIdsByRole, notifyWorkspaceUsers } from "@/lib/workspace/notifications";
import { z } from "zod";
import { parseRouteParams } from "@/lib/validation/http";
import { uuid } from "@/lib/validation/schemas";
import type { WorkspaceRole } from "@/types";

export const dynamic = "force-dynamic";

const ReportParams = z.object({ id: uuid, reportId: uuid });

// POST /api/workspace/[id]/reports/[reportId]/archive
// Only Owner/Manager can archive an official report — once archived
// it's read-only and can no longer be resubmitted for that period.
export async function POST(
  _req: NextRequest,
  props: { params: Promise<{ id: string; reportId: string }> }
) {
  const parsedParams = parseRouteParams(await props.params, ReportParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const admin    = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", params.id)
    .eq("user_id", user.id)
    .single();
  if (!membership) return NextResponse.json({ error: "Not a member." }, { status: 403 });
  const archiverRole = membership.role as WorkspaceRole;
  if (!canManageSubmittedReports(archiverRole)) {
    return NextResponse.json({ error: "Only the Owner or Manager can archive a report." }, { status: 403 });
  }

  const { data: existing } = await supabase
    .from("workspace_reports")
    .select("id, status, submitted_by, range_from, range_to")
    .eq("workspace_id", params.id)
    .eq("id", params.reportId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  if (existing.status === "archived") return NextResponse.json({ report: existing });

  const { data: saved, error } = await supabase
    .from("workspace_reports")
    .update({ status: "archived", archived_by: user.id, archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", params.reportId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: userData } = await admin.auth.admin.getUserById(user.id);
  const userName = userData?.user?.user_metadata?.full_name || userData?.user?.email || "Unknown";

  await logActivity(supabase, params.id, user.id, WorkspaceActions.REPORT_ARCHIVED, {
    entityType: "workspace_report",
    entityId:   params.reportId,
    metadata:   { user_name: userName, target_name: `${existing.range_from} – ${existing.range_to}` },
  });

  // Who gets notified depends on who did the archiving:
  //  - Manager archives  -> notify the Analyst (submitter) and the Owner
  //  - Owner archives    -> notify the Analyst (submitter) and the Manager
  // The archiver themselves is never notified about their own action.
  const recipientIds = new Set<string>();
  if (existing.submitted_by && existing.submitted_by !== user.id) {
    recipientIds.add(existing.submitted_by);
  }
  const counterpartRole: WorkspaceRole = archiverRole === "manager" ? "owner" : "manager";
  const counterpartIds = await getMemberIdsByRole(supabase, params.id, [counterpartRole], user.id);
  counterpartIds.forEach((id) => recipientIds.add(id));

  if (recipientIds.size > 0) {
    await notifyWorkspaceUsers(
      params.id,
      Array.from(recipientIds),
      "report_archived",
      "A report was archived",
      `${userName} archived the Team Analytics report for ${existing.range_from} – ${existing.range_to}.`,
      { entityType: "workspace_report", entityId: params.reportId }
    );
  }

  return NextResponse.json({ report: saved });
}
