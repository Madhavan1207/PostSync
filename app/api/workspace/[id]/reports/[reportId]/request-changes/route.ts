import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity, WorkspaceActions } from "@/lib/workspace/activity-logger";
import { canRequestReportChanges } from "@/lib/workspace/permissions";
import { notifyWorkspaceUsers } from "@/lib/workspace/notifications";
import { z } from "zod";
import { parseJsonBody, parseRouteParams } from "@/lib/validation/http";
import { uuid } from "@/lib/validation/schemas";
import type { WorkspaceRole } from "@/types";

export const dynamic = "force-dynamic";

const ReportParams = z.object({ id: uuid, reportId: uuid });

/**
 * `note` stays optional: `change_request_note` is nullable and the handler
 * already stores `null` for an empty note.
 */
const RequestChangesBody = z.object({
  note: z.string().max(2_000, "Must be 2000 characters or fewer.").optional(),
});

// POST /api/workspace/[id]/reports/[reportId]/request-changes
// Body: { note }
// Owner and Manager can send a submitted report back to the Analyst
// for edits — this is the one exception to "Analyst can't modify a
// report after submission."
export async function POST(
  req: NextRequest,
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
  if (!canRequestReportChanges(membership.role as WorkspaceRole)) {
    return NextResponse.json({ error: "Only the Owner or Manager can request changes on a report." }, { status: 403 });
  }

  const parsed = await parseJsonBody(req, RequestChangesBody);
  if (!parsed.success) return parsed.response;
  const note = (parsed.data.note ?? "").trim();

  const { data: existing } = await supabase
    .from("workspace_reports")
    .select("id, status, submitted_by, range_from, range_to")
    .eq("workspace_id", params.id)
    .eq("id", params.reportId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  if (existing.status === "archived") {
    return NextResponse.json({ error: "This report is archived and can no longer be edited." }, { status: 409 });
  }

  const { data: saved, error } = await supabase
    .from("workspace_reports")
    .update({
      status: "changes_requested",
      change_request_note: note || null,
      change_requested_by: user.id,
      change_requested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.reportId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: userData } = await admin.auth.admin.getUserById(user.id);
  const userName = userData?.user?.user_metadata?.full_name || userData?.user?.email || "Unknown";

  await logActivity(supabase, params.id, user.id, WorkspaceActions.REPORT_CHANGES_REQUESTED, {
    entityType: "workspace_report",
    entityId:   params.reportId,
    metadata:   { user_name: userName, reason: note, target_name: `${existing.range_from} – ${existing.range_to}` },
  });

  if (existing.submitted_by) {
    await notifyWorkspaceUsers(
      params.id,
      [existing.submitted_by],
      "report_changes_requested",
      "Changes requested on your report",
      `${userName} requested changes on the report for ${existing.range_from} – ${existing.range_to}${note ? `: "${note}"` : "."}`,
      { entityType: "workspace_report", entityId: params.reportId }
    );
  }

  return NextResponse.json({ report: saved });
}
