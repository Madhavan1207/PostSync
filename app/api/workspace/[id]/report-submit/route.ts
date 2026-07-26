import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity, WorkspaceActions } from "@/lib/workspace/activity-logger";
import { canSubmitReport, canViewTeamAnalytics } from "@/lib/workspace/permissions";
import { getMemberIdsByRole, notifyWorkspaceUsers } from "@/lib/workspace/notifications";
import { z } from "zod";
import { parseJsonBody, parseRouteParams, parseSearchParams } from "@/lib/validation/http";
import { idParams } from "@/lib/validation/schemas";
import type { WorkspaceRole } from "@/types";

export const dynamic = "force-dynamic";

/** `range_from` / `range_to` are `date` columns; the client sends YYYY-MM-DD. */
const rangeDate = z.iso.date("Must be a YYYY-MM-DD date.");
const rangeKey = z.enum(["today", "7d", "30d", "custom"]);

/** Both were already required — an absent `from`/`to` was a 400 before, too. */
const ReportSubmitQuery = z.object({ from: rangeDate, to: rangeDate });

/**
 * The text columns are `NOT NULL DEFAULT ''` and the handler coerces absent to
 * "", so these stay plain optional strings rather than `optionalString()`.
 * `chartsData` / `analyticsData` are snapshot blobs written straight to `jsonb`
 * columns; their inner shape is the dashboard's concern, so they are validated
 * as JSON objects rather than field-by-field.
 */
const SubmitReportBody = z.object({
  rangeKey: rangeKey.optional(),
  from: rangeDate,
  to: rangeDate,
  executiveSummary: z.string().max(20_000, "Must be 20000 characters or fewer.").optional(),
  observations: z.string().max(10_000, "Must be 10000 characters or fewer.").optional(),
  recommendations: z.string().max(10_000, "Must be 10000 characters or fewer.").optional(),
  chartsData: z.record(z.string(), z.unknown()).optional(),
  analyticsData: z.record(z.string(), z.unknown()).optional(),
});

async function getMembership(supabase: Awaited<ReturnType<typeof createClient>>, workspaceId: string, userId: string) {
  const { data } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .single();
  return data;
}

// GET /api/workspace/[id]/report-submit?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns the official submitted report for this exact range (if any),
// so the Analyst dashboard knows whether to show "Submit Report",
// "Resubmit Report" (changes requested), or a read-only "Submitted" state.
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const parsedParams = parseRouteParams(await props.params, idParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await getMembership(supabase, params.id, user.id);
  if (!membership) return NextResponse.json({ error: "Not a member." }, { status: 403 });
  if (!canViewTeamAnalytics(membership.role as WorkspaceRole)) {
    return NextResponse.json({ error: "Not permitted to view this report." }, { status: 403 });
  }

  const parsedQuery = parseSearchParams(req.nextUrl, ReportSubmitQuery);
  if (!parsedQuery.success) return parsedQuery.response;
  const { from, to } = parsedQuery.data;

  const { data: report } = await supabase
    .from("workspace_reports")
    .select("id, status, submitted_by, submitted_at, change_request_note, change_requested_at")
    .eq("workspace_id", params.id)
    .eq("range_from", from)
    .eq("range_to", to)
    .maybeSingle();

  if (!report) return NextResponse.json({ report: null });

  const admin = createAdminClient();
  let submittedByName: string | null = null;
  if (report.submitted_by) {
    const { data: userData } = await admin.auth.admin.getUserById(report.submitted_by);
    submittedByName = userData?.user?.user_metadata?.full_name || userData?.user?.email || null;
  }

  return NextResponse.json({ report: { ...report, submitted_by_name: submittedByName } });
}

// POST /api/workspace/[id]/report-submit
// Body: { rangeKey, from, to, observations, recommendations, executiveSummary, chartsData, analyticsData }
// Only the Owner/Analyst may submit (canSubmitReport) — this is the
// "Submit Report" action that replaces the old "Save Review" button.
// Turns the working review into an official, workspace-visible
// report and notifies every Owner/Manager.
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const parsedParams = parseRouteParams(await props.params, idParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const admin    = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await getMembership(supabase, params.id, user.id);
  if (!membership) return NextResponse.json({ error: "Not a member." }, { status: 403 });
  if (!canSubmitReport(membership.role as WorkspaceRole)) {
    return NextResponse.json({ error: "Only the Analyst or Owner can submit this report." }, { status: 403 });
  }

  const parsed = await parseJsonBody(req, SubmitReportBody);
  if (!parsed.success) return parsed.response;
  const { rangeKey: bodyRangeKey, from, to, observations, recommendations, executiveSummary, chartsData, analyticsData } = parsed.data;

  const { data: existing } = await supabase
    .from("workspace_reports")
    .select("id, status")
    .eq("workspace_id", params.id)
    .eq("range_from", from)
    .eq("range_to", to)
    .maybeSingle();

  if (existing && existing.status === "submitted") {
    return NextResponse.json({ error: "This report has already been submitted. Ask the Owner to request changes before resubmitting." }, { status: 409 });
  }
  if (existing && existing.status === "archived") {
    return NextResponse.json({ error: "This report period has already been archived and can't be resubmitted." }, { status: 409 });
  }

  const isResubmission = !!existing; // only reachable when status === 'changes_requested'

  const fields = {
    workspace_id:         params.id,
    range_key:            bodyRangeKey || "custom",
    range_from:            from,
    range_to:              to,
    status:               "submitted",
    executive_summary:    (executiveSummary ?? "").toString(),
    observations:         (observations ?? "").toString(),
    recommendations:      (recommendations ?? "").toString(),
    charts_data:          chartsData ?? {},
    analytics_data:       analyticsData ?? {},
    submitted_by:         user.id,
    submitted_at:         new Date().toISOString(),
    change_request_note:  null,
    change_requested_by:  null,
    change_requested_at:  null,
    updated_at:           new Date().toISOString(),
  };

  const { data: saved, error } = isResubmission
    ? await supabase.from("workspace_reports").update(fields).eq("id", existing!.id).select().single()
    : await supabase.from("workspace_reports").insert(fields).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: userData } = await admin.auth.admin.getUserById(user.id);
  const userName = userData?.user?.user_metadata?.full_name || userData?.user?.email || "Unknown";

  await logActivity(supabase, params.id, user.id, isResubmission ? WorkspaceActions.REPORT_RESUBMITTED : WorkspaceActions.REPORT_SUBMITTED, {
    entityType: "workspace_report",
    entityId:   saved.id,
    metadata:   { user_name: userName, target_name: `${from} – ${to}` },
  });

  // Notify every Owner/Manager (except the submitter, if they happen
  // to hold one of those roles) that a new official report is ready.
  const recipientIds = await getMemberIdsByRole(supabase, params.id, ["owner", "manager"], user.id);
  await notifyWorkspaceUsers(
    params.id,
    recipientIds,
    "report_submitted",
    isResubmission ? "A report was resubmitted" : "A new report was submitted",
    `${userName} ${isResubmission ? "resubmitted" : "submitted"} the Team Analytics report for ${from} – ${to}.`,
    { entityType: "workspace_report", entityId: saved.id }
  );

  return NextResponse.json({ report: { ...saved, submitted_by_name: userName } });
}
