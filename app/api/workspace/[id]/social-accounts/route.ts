import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageSocialAccounts } from "@/lib/workspace/permissions";
import { logActivity, WorkspaceActions } from "@/lib/workspace/activity-logger";
import { z } from "zod";
import { parseRouteParams, parseSearchParams } from "@/lib/validation/http";
import { idParams, nonEmptyString, platformId } from "@/lib/validation/schemas";
import type { WorkspaceRole } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Both were already required — an absent `platform`/`accountId` was a 400 before.
 * `platform` uses the shared enum: the column only ever holds a known platform id,
 * so anything else could never have matched a row.
 */
const DisconnectAccountQuery = z.object({
  platform: platformId,
  accountId: nonEmptyString(255),
});

// ── GET /api/workspace/[id]/members ─── (helper, shared below) ─
async function getMembership(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, workspaceId: string) {
  const { data } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .single();
  return data;
}

// ── GET /api/workspace/[id]/social-accounts ───────────────────
// Any workspace member can view which accounts the workspace is
// connected to (read-only for Creators/Analysts).
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const parsedParams = parseRouteParams(await props.params, idParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await getMembership(supabase, user.id, params.id);
  if (!membership) return NextResponse.json({ error: "Not a member of this workspace." }, { status: 403 });

  const { data: accounts, error } = await supabase
    .from("social_accounts")
    .select("id, platform, account_id, account_name, account_avatar_url, status, metadata, connected_at, connected_by, updated_at")
    .eq("workspace_id", params.id)
    .order("platform", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enriched = await Promise.all(
    (accounts || []).map(async (a) => {
      if (!a.connected_by) return { ...a, connected_by_name: "Unknown" };
      const { data: userData } = await admin.auth.admin.getUserById(a.connected_by);
      return {
        ...a,
        connected_by_name: userData?.user?.user_metadata?.full_name || userData?.user?.email || "Unknown",
      };
    })
  );

  return NextResponse.json({
    accounts: enriched,
    canManage: canManageSocialAccounts(membership.role as WorkspaceRole),
  });
}

// ── DELETE /api/workspace/[id]/social-accounts?platform=X&accountId=Y
// Only Owner/Manager can disconnect a workspace-owned account.
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const parsedParams = parseRouteParams(await props.params, idParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await getMembership(supabase, user.id, params.id);
  if (!membership) return NextResponse.json({ error: "Not a member of this workspace." }, { status: 403 });

  if (!canManageSocialAccounts(membership.role as WorkspaceRole)) {
    return NextResponse.json({ error: "Only the workspace Owner or a Manager can disconnect social accounts." }, { status: 403 });
  }

  const parsedQuery = parseSearchParams(req.nextUrl, DisconnectAccountQuery);
  if (!parsedQuery.success) return parsedQuery.response;
  const { platform, accountId } = parsedQuery.data;

  // Use the admin client for the delete so it isn't blocked by RLS edge cases,
  // but only after the membership + role check above has authorized it.
  const { error } = await admin
    .from("social_accounts")
    .delete()
    .eq("workspace_id", params.id)
    .eq("platform", platform)
    .eq("account_id", accountId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: userData } = await admin.auth.admin.getUserById(user.id);
  const userName = userData?.user?.user_metadata?.full_name || userData?.user?.email || "Unknown";
  await logActivity(supabase, params.id, user.id, WorkspaceActions.WORKSPACE_UPDATED, {
    metadata: { user_name: userName, target_name: `Disconnected ${platform}` },
  });

  return NextResponse.json({ ok: true });
}
