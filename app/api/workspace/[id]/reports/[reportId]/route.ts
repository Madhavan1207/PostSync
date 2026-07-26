import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageSubmittedReports, canViewReportsSection } from "@/lib/workspace/permissions";
import { logActivity, WorkspaceActions } from "@/lib/workspace/activity-logger";
import { z } from "zod";
import { parseRouteParams } from "@/lib/validation/http";
import { uuid } from "@/lib/validation/schemas";
import type { WorkspaceRole } from "@/types";

export const dynamic = "force-dynamic";

const ReportParams = z.object({ id: uuid, reportId: uuid });

// GET /api/workspace/[id]/reports/[reportId]
// Full detail for "View Report" / "Download PDF" / "Download CSV":
// Executive Summary, Analyst Observations, Recommendations, Charts,
// and Team & Platform Analytics, exactly as they were at submission
// time. Owner/Manager may open any report; the Analyst may only open
// their own submissions.
export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string; reportId: string }> }
) {
  const parsedParams = parseRouteParams(await props.params, ReportParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", params.id)
    .eq("user_id", user.id)
    .single();
  if (!membership) return NextResponse.json({ error: "Not a member." }, { status: 403 });

  const role = membership.role as WorkspaceRole;
  if (!canViewReportsSection(role)) {
    return NextResponse.json({ error: "Not permitted to view Reports." }, { status: 403 });
  }

  const { data: report, error } = await supabase
    .from("workspace_reports")
    .select("*")
    .eq("workspace_id", params.id)
    .eq("id", params.reportId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });

  if (!canManageSubmittedReports(role) && report.submitted_by !== user.id) {
    return NextResponse.json({ error: "You can only view reports you submitted." }, { status: 403 });
  }

  const admin = createAdminClient();
  const idsToName = Array.from(new Set([report.submitted_by, report.change_requested_by, report.archived_by].filter(Boolean))) as string[];
  const nameById: Record<string, string> = {};
  await Promise.all(idsToName.map(async (id) => {
    const { data: userData } = await admin.auth.admin.getUserById(id);
    nameById[id] = userData?.user?.user_metadata?.full_name || userData?.user?.email || "Unknown";
  }));

  return NextResponse.json({
    report: {
      ...report,
      submitted_by_name: report.submitted_by ? nameById[report.submitted_by] || null : null,
      change_requested_by_name: report.change_requested_by ? nameById[report.change_requested_by] || null : null,
      archived_by_name: report.archived_by ? nameById[report.archived_by] || null : null,
    },
  });
}

// DELETE /api/workspace/[id]/reports/[reportId]
// Permanently removes an archived report. Only the Owner or Manager
// may do this (canManageSubmittedReports), and only once the report
// has actually been archived — a live "submitted" or
// "changes_requested" report can't be deleted out from under the
// Analyst.
export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string; reportId: string }> }
) {
  const parsedParams = parseRouteParams(await props.params, ReportParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", params.id)
    .eq("user_id", user.id)
    .single();
  if (!membership) return NextResponse.json({ error: "Not a member." }, { status: 403 });

  const role = membership.role as WorkspaceRole;
  if (!canManageSubmittedReports(role)) {
    return NextResponse.json({ error: "Only the Owner or Manager can remove an archived report." }, { status: 403 });
  }

  const { data: existing } = await supabase
    .from("workspace_reports")
    .select("id, status, range_from, range_to")
    .eq("workspace_id", params.id)
    .eq("id", params.reportId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  if (existing.status !== "archived") {
    return NextResponse.json({ error: "Only archived reports can be removed." }, { status: 409 });
  }

  const { error } = await supabase
    .from("workspace_reports")
    .delete()
    .eq("id", params.reportId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const admin = createAdminClient();
  const { data: userData } = await admin.auth.admin.getUserById(user.id);
  const userName = userData?.user?.user_metadata?.full_name || userData?.user?.email || "Unknown";

  await logActivity(supabase, params.id, user.id, WorkspaceActions.REPORT_DELETED, {
    entityType: "workspace_report",
    entityId:   params.reportId,
    metadata:   { user_name: userName, target_name: `${existing.range_from} – ${existing.range_to}` },
  });

  return NextResponse.json({ ok: true });
}
