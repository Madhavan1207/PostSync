import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActionLabel, type WorkspaceAction } from "@/lib/workspace/activity-logger";
import { parseRouteParams, parseSearchParams } from "@/lib/validation/http";
import { idParams, queryInt } from "@/lib/validation/schemas";
import type { WorkspaceRole, WorkspaceActivityLog } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Defaults match the previous `parseInt(param || "30")` behaviour exactly, so an
 * omitted parameter still yields a 30-row page from offset 0. The upper bound on
 * `limit` is new — it stops a caller asking for an unbounded page, and every
 * in-repo caller relies on the default rather than passing a value.
 */
const ActivityQuery = z.object({
  limit:  queryInt({ min: 1, max: 100, default: 30 }),
  offset: queryInt({ min: 0, default: 0 }),
});

// ── GET /api/workspace/[id]/activity ────────────────────────
// Returns paginated activity log for a workspace
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const parsedParams = parseRouteParams(await props.params, idParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const admin    = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Must be a member
  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "Not a member of this workspace." }, { status: 403 });
  }

  // Pagination via query params
  const parsedQuery = parseSearchParams(req.nextUrl, ActivityQuery);
  if (!parsedQuery.success) return parsedQuery.response;
  const { limit, offset } = parsedQuery.data;

  const { data: logs, error, count } = await supabase
    .from("workspace_activity_log")
    .select("*", { count: "exact" })
    .eq("workspace_id", params.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with user info
  const enriched = await Promise.all(
    (logs || []).map(async (log) => {
      const { data: userData } = await admin.auth.admin.getUserById(log.user_id);
      const userName   = userData?.user?.user_metadata?.full_name || userData?.user?.email || "Unknown";
      const avatarUrl  = userData?.user?.user_metadata?.avatar_url || "";
      const metadata   = { ...((log.metadata as Record<string, unknown>) || {}), user_name: userName };
      return {
        ...log,
        user_name:   userName,
        user_avatar: avatarUrl,
        label:       getActionLabel(log.action as WorkspaceAction, metadata),
      } as WorkspaceActivityLog & { label: string };
    })
  );

  return NextResponse.json({
    logs:   enriched,
    total:  count ?? 0,
    limit,
    offset,
  });
}
