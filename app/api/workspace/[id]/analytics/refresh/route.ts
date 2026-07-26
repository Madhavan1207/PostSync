import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAnalyticsDashboard, type AnalyticsAccount } from "@/lib/analytics/social-analytics";
import {
  writeWorkspaceAnalyticsCache,
  markWorkspaceCacheRefreshing,
  invalidateWorkspaceAnalyticsCache,
} from "@/lib/analytics/analytics-cache";
import { z } from "zod";
import { parseOptionalJsonBody, parseRouteParams } from "@/lib/validation/http";
import { idParams } from "@/lib/validation/schemas";
import type { WorkspaceRole, ScheduledPost } from "@/types";
import { canViewTeamAnalytics } from "@/lib/workspace/permissions";

export const dynamic = "force-dynamic";

/**
 * `force` is the only field either call site sends. It stays optional so an
 * omitted flag keeps meaning "background refresh" (force = false).
 */
const RefreshAnalyticsBody = z.object({
  force: z.boolean().optional(),
});

// POST /api/workspace/[id]/analytics/refresh
// Same two call sites as the personal version:
//   1. Background refresh when the dashboard detects a stale cache
//   2. The "Refresh" button (force = true — invalidates cache first)
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
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
  if (!canViewTeamAnalytics(membership.role as WorkspaceRole)) {
    return NextResponse.json({ error: "Creators cannot view team analytics." }, { status: 403 });
  }

  // Body may be omitted entirely — a bodyless POST means a background refresh.
  const parsed = await parseOptionalJsonBody(req, RefreshAnalyticsBody);
  if (!parsed.success) return parsed.response;
  const force = parsed.data.force === true;

  if (force) {
    await invalidateWorkspaceAnalyticsCache(params.id);
  } else {
    const acquired = await markWorkspaceCacheRefreshing(params.id);
    if (!acquired) return NextResponse.json({ status: "already_refreshing" });
  }

  try {
    const [{ data: workspaceAccounts }, { data: workspaceScheduledPosts }] = await Promise.all([
      supabase
        .from("social_accounts")
        .select("id, platform, account_id, account_name, account_avatar_url, status, scopes, metadata, connected_at, updated_at, access_token, refresh_token, token_expires_at")
        .eq("workspace_id", params.id),
      supabase.from("scheduled_posts").select("*").eq("workspace_id", params.id),
    ]);

    const accounts = (workspaceAccounts || []) as AnalyticsAccount[];
    const posts = (workspaceScheduledPosts || []) as ScheduledPost[];

    const analytics = await getAnalyticsDashboard(accounts, posts, { restrictToScheduled: true });
    await writeWorkspaceAnalyticsCache(params.id, user.id, analytics);

    return NextResponse.json({ status: "refreshed", generatedAt: analytics.generatedAt });
  } catch (error) {
    try {
      const admin = createAdminClient();
      await admin.from("analytics_cache").update({ is_refreshing: false }).eq("workspace_id", params.id);
    } catch {
      // best effort
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Refresh failed" },
      { status: 500 }
    );
  }
}
