import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageSubmittedReports, canViewReportsSection } from "@/lib/workspace/permissions";
import { parseRouteParams } from "@/lib/validation/http";
import { idParams } from "@/lib/validation/schemas";
import type { WorkspaceRole } from "@/types";

export const dynamic = "force-dynamic";

// GET /api/workspace/[id]/reports
// Powers the "Reports" section: Owner/Manager see every submitted
// report in the workspace; the Analyst sees only the reports they
// personally submitted (their submission history). Creator/Manager-
// without-permission get a 403 — Manager can view but not manage.
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const parsedParams = parseRouteParams(await props.params, idParams);
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

  let query = supabase
    .from("workspace_reports")
    .select("id, range_key, range_from, range_to, status, submitted_by, submitted_at, change_request_note, change_requested_by, change_requested_at, archived_by, archived_at, updated_at")
    .eq("workspace_id", params.id)
    .order("submitted_at", { ascending: false });

  // The Analyst's "submission history" is scoped to their own reports;
  // Owner/Manager get the full oversight list.
  if (!canManageSubmittedReports(role)) {
    query = query.eq("submitted_by", user.id);
  }

  const { data: reports, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const admin = createAdminClient();
  const userIds = Array.from(new Set((reports || []).flatMap((r) => [r.submitted_by, r.change_requested_by, r.archived_by].filter(Boolean)))) as string[];
  const nameById = new Map<string, string>();
  await Promise.all(userIds.map(async (id) => {
    const { data: userData } = await admin.auth.admin.getUserById(id);
    nameById.set(id, userData?.user?.user_metadata?.full_name || userData?.user?.email || "Unknown");
  }));

  const enriched = (reports || []).map((r) => ({
    ...r,
    submitted_by_name: r.submitted_by ? nameById.get(r.submitted_by) || null : null,
    change_requested_by_name: r.change_requested_by ? nameById.get(r.change_requested_by) || null : null,
    archived_by_name: r.archived_by ? nameById.get(r.archived_by) || null : null,
  }));

  return NextResponse.json({ reports: enriched });
}
