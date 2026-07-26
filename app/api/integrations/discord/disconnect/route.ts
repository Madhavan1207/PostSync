import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DISCORD_PLATFORM } from "@/lib/integrations/discord";
import { canManageSocialAccounts } from "@/lib/workspace/permissions";
import type { WorkspaceRole } from "@/types";
import { readWorkspaceIdParam } from "@/lib/validation/oauth";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  const requestUrl = new URL(request.url);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // Fetch-called endpoint, so an invalid id is a normal 400 rather than a redirect.
  const workspaceParam = readWorkspaceIdParam(requestUrl);
  if (workspaceParam.present && !workspaceParam.valid) {
    return NextResponse.json({ error: "Invalid workspace id." }, { status: 400 });
  }
  const workspaceId = workspaceParam.present ? workspaceParam.workspaceId : null;

  if (workspaceId) {
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("*")
      .eq("user_id", user.id)
      .eq("workspace_id", workspaceId)
      .single();

    if (!membership || !canManageSocialAccounts(membership.role as WorkspaceRole)) {
      return NextResponse.json({ error: "Only the workspace Owner or a Manager can disconnect social accounts." }, { status: 403 });
    }

    await supabase.from("social_accounts")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("platform", DISCORD_PLATFORM);
  } else {
    await supabase.from("social_accounts")
      .delete()
      .eq("user_id", user.id)
      .eq("platform", DISCORD_PLATFORM)
      .is("workspace_id", null);
  }

  return NextResponse.json({ ok: true });
}
