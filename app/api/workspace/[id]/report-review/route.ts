import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity, WorkspaceActions } from "@/lib/workspace/activity-logger";
import { z } from "zod";
import { canManageReportInsights, canViewTeamAnalytics } from "@/lib/workspace/permissions";
import { parseJsonBody, parseRouteParams, parseSearchParams } from "@/lib/validation/http";
import { idParams } from "@/lib/validation/schemas";
import type { WorkspaceRole } from "@/types";

export const dynamic = "force-dynamic";

/**
 * `range_from` / `range_to` are `date` columns and the client sends plain
 * YYYY-MM-DD, so this is a calendar date rather than the shared `isoDateTime`.
 */
const rangeDate = z.iso.date("Must be a YYYY-MM-DD date.");

/** `range_key` is free text in the DB, but the dashboard is its only producer. */
const rangeKey = z.enum(["today", "7d", "30d", "custom"]);

/** Both were already required — an absent `from`/`to` was a 400 before, too. */
const ReportReviewQuery = z.object({ from: rangeDate, to: rangeDate });

/**
 * `observations` / `recommendations` stay plain optional strings: the columns are
 * `text NOT NULL DEFAULT ''` and the handler coerces absent to "", so "" is a
 * meaningful value that clears a previously saved note.
 */
const SaveReportReviewBody = z.object({
  rangeKey: rangeKey.optional(),
  from: rangeDate,
  to: rangeDate,
  observations: z.string().max(10_000, "Must be 10000 characters or fewer.").optional(),
  recommendations: z.string().max(10_000, "Must be 10000 characters or fewer.").optional(),
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

// GET /api/workspace/[id]/report-review?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns the saved Observations/Recommendations for this exact
// report range, or null if the Analyst hasn't reviewed this period yet.
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

  const parsedQuery = parseSearchParams(req.nextUrl, ReportReviewQuery);
  if (!parsedQuery.success) return parsedQuery.response;
  const { from, to } = parsedQuery.data;

  const { data: review } = await supabase
    .from("workspace_report_reviews")
    .select("*")
    .eq("workspace_id", params.id)
    .eq("range_from", from)
    .eq("range_to", to)
    .maybeSingle();

  if (!review) return NextResponse.json({ review: null });

  const admin = createAdminClient();
  let reviewerName: string | null = null;
  if (review.reviewed_by) {
    const { data: userData } = await admin.auth.admin.getUserById(review.reviewed_by);
    reviewerName = userData?.user?.user_metadata?.full_name || userData?.user?.email || null;
  }

  return NextResponse.json({ review: { ...review, reviewer_name: reviewerName } });
}

// POST /api/workspace/[id]/report-review
// Body: { rangeKey, from, to, observations, recommendations }
// Only Owner/Analyst may write (canManageReportInsights) — Manager can
// generate and read the report but not sign off on it.
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
  if (!canManageReportInsights(membership.role as WorkspaceRole)) {
    return NextResponse.json({ error: "Only the Analyst or Owner can add observations and recommendations." }, { status: 403 });
  }

  const parsed = await parseJsonBody(req, SaveReportReviewBody);
  if (!parsed.success) return parsed.response;
  const { rangeKey: bodyRangeKey, from, to, observations, recommendations } = parsed.data;

  const fields = {
    workspace_id:    params.id,
    range_key:       bodyRangeKey || "custom",
    range_from:       from,
    range_to:         to,
    observations:    (observations ?? "").toString(),
    recommendations: (recommendations ?? "").toString(),
    reviewed_by:     user.id,
    reviewed_at:     new Date().toISOString(),
    updated_at:      new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("workspace_report_reviews")
    .select("id")
    .eq("workspace_id", params.id)
    .eq("range_from", from)
    .eq("range_to", to)
    .maybeSingle();

  const { data: saved, error } = existing?.id
    ? await supabase.from("workspace_report_reviews").update(fields).eq("id", existing.id).select().single()
    : await supabase.from("workspace_report_reviews").insert(fields).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: userData } = await admin.auth.admin.getUserById(user.id);
  const userName = userData?.user?.user_metadata?.full_name || userData?.user?.email || "Unknown";
  await logActivity(supabase, params.id, user.id, WorkspaceActions.REPORT_REVIEW_SAVED, {
    entityType: "workspace_report_review",
    entityId:   saved.id,
    metadata: {
      user_name: userName,
      has_observations: !!observations?.trim(),
      has_recommendations: !!recommendations?.trim(),
    },
  });

  return NextResponse.json({ review: { ...saved, reviewer_name: userName } });
}
