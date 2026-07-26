import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAnalyticsDashboard, type AnalyticsAccount } from "@/lib/analytics/social-analytics";
import { readWorkspaceAnalyticsCache, writeWorkspaceAnalyticsCache } from "@/lib/analytics/analytics-cache";
import { getActionLabel, type WorkspaceAction } from "@/lib/workspace/activity-logger";
import { parseRouteParams } from "@/lib/validation/http";
import { idParams } from "@/lib/validation/schemas";
import type { WorkspaceRole, ScheduledPost } from "@/types";
import { canViewTeamAnalytics } from "@/lib/workspace/permissions";

export const dynamic = "force-dynamic";

// GET /api/workspace/[id]/analytics
// Returns everything the Team Analytics dashboard needs in one call:
// workspace-wide status counts, live platform performance (cached,
// same stale-while-revalidate pattern as Solo Analytics), per-member
// contribution, and a recent publishing activity timeline. Aggregation
// by date range, best time/day, trends, etc. happens client-side from
// this raw data — same approach the Solo Analytics page already uses
// for its own trend/period filters.
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const parsedParams = parseRouteParams(await props.params, idParams);
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
  if (!canViewTeamAnalytics(membership.role as WorkspaceRole)) {
    return NextResponse.json({ error: "Creators cannot view team analytics." }, { status: 403 });
  }

  const [
    { data: members },
    { data: allDrafts },
    { data: workspaceScheduledPosts },
    { data: workspaceAccounts },
    { data: activityLogs },
  ] = await Promise.all([
    supabase.from("workspace_members").select("*").eq("workspace_id", params.id),
    supabase.from("workspace_drafts").select("*").eq("workspace_id", params.id),
    supabase.from("scheduled_posts").select("*").eq("workspace_id", params.id),
    supabase
      .from("social_accounts")
      .select("id, platform, account_id, account_name, account_avatar_url, status, scopes, metadata, connected_at, updated_at, access_token, refresh_token, token_expires_at")
      .eq("workspace_id", params.id),
    supabase
      .from("workspace_activity_log")
      .select("*")
      .eq("workspace_id", params.id)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const drafts = allDrafts || [];
  const scheduledPosts = (workspaceScheduledPosts || []) as ScheduledPost[];
  const accounts = (workspaceAccounts || []) as AnalyticsAccount[];

  // ── Live platform performance (cached, stale-while-revalidate) ──────────
  const cached = await readWorkspaceAnalyticsCache(params.id);
  let analytics: Awaited<ReturnType<typeof getAnalyticsDashboard>>;
  let servedFromCache = false;
  let cacheStale = false;

  if (cached.hit) {
    analytics = cached.data;
    servedFromCache = true;
    cacheStale = cached.stale;
  } else {
    analytics = await getAnalyticsDashboard(accounts, scheduledPosts, { restrictToScheduled: true });
    void writeWorkspaceAnalyticsCache(params.id, user.id, analytics);
  }

  // ── Member identity ────────────────────────────────────────────────────
  // Role-specific contribution metrics (drafts edited, approvals, reports
  // generated, etc.) are computed client-side from `drafts` + `activity` +
  // `scheduledPosts` below, the same way overview/engagement/trends are —
  // that's what lets the dashboard's date-range filter apply to them too.
  const enrichedMembers = await Promise.all((members || []).map(async (m) => {
    const { data: userData } = await admin.auth.admin.getUserById(m.user_id);
    return {
      ...m,
      email:      userData?.user?.email ?? "",
      full_name:  userData?.user?.user_metadata?.full_name ?? "",
      avatar_url: userData?.user?.user_metadata?.avatar_url ?? "",
    };
  }));

  // ── Recent publishing activity timeline ──────────────────────────────────
  const actorIds = Array.from(new Set((activityLogs || []).map((l) => l.user_id)));
  const actorNames = new Map<string, { name: string; avatar: string }>();
  await Promise.all(actorIds.map(async (id) => {
    const { data: userData } = await admin.auth.admin.getUserById(id);
    actorNames.set(id, {
      name: userData?.user?.user_metadata?.full_name || userData?.user?.email || "Unknown",
      avatar: userData?.user?.user_metadata?.avatar_url || "",
    });
  }));

  const activity = (activityLogs || []).map((log) => {
    const actor = actorNames.get(log.user_id);
    const rawMetadata = (log.metadata as Record<string, unknown>) || {};
    const metadata = { ...rawMetadata, user_name: actor?.name };
    return {
      id: log.id,
      user_id: log.user_id,
      action: log.action,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      created_at: log.created_at,
      user_name: actor?.name || "Unknown",
      user_avatar: actor?.avatar || "",
      label: getActionLabel(log.action as WorkspaceAction, metadata),
      metadata: rawMetadata,
    };
  });

  // ── Workspace-wide status counts ─────────────────────────────────────────
  const overview = {
    published:       drafts.filter((d) => d.status === "published").length,
    scheduled:       drafts.filter((d) => d.status === "scheduled").length,
    failed:          drafts.filter((d) => d.status === "failed").length,
    pendingApproval: drafts.filter((d) => d.status === "pending_approval").length,
    approved:        drafts.filter((d) => d.status === "approved").length,
    drafts:          drafts.filter((d) => d.status === "draft").length,
    rejected:        drafts.filter((d) => d.status === "rejected").length,
    total:           drafts.length,
  };

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    servedFromCache,
    cacheStale,
    overview,
    drafts,
    scheduledPosts,
    analytics,
    members: enrichedMembers,
    activity,
    workspaceAccountsCount: accounts.length,
  });
}
