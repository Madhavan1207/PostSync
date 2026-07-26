import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity, WorkspaceActions } from "@/lib/workspace/activity-logger";
import { canDeleteWorkspace } from "@/lib/workspace/permissions";
import { parseJsonBody, parseRouteParams } from "@/lib/validation/http";
import { idParams, nonEmptyString } from "@/lib/validation/schemas";
import type { WorkspaceRole } from "@/types";

export const dynamic = "force-dynamic";

/**
 * `description` is a plain optional string rather than `optionalString()`:
 * the column is `text NOT NULL DEFAULT ''`, so "" is a meaningful value that
 * clears the team profile. Coercing "" to undefined would make it unclearable.
 */
const UpdateWorkspaceBody = z.object({
  name: nonEmptyString(100),
  description: z.string().trim().max(500, "Must be 500 characters or fewer.").optional(),
});

// ── Helper: get user's role in a workspace ───────────────────
async function getUserRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  userId: string
): Promise<WorkspaceRole | null> {
  const { data } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .single();
  return (data?.role as WorkspaceRole) ?? null;
}

// ── PATCH /api/workspace/[id] ────────────────────────────────
// Update workspace name (owner only)
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const parsedParams = parseRouteParams(await props.params, idParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const admin    = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getUserRole(supabase, params.id, user.id);
  if (role !== "owner") {
    return NextResponse.json({ error: "Only the workspace owner can update workspace settings." }, { status: 403 });
  }

  const parsed = await parseJsonBody(req, UpdateWorkspaceBody);
  if (!parsed.success) return parsed.response;
  const { name, description } = parsed.data;

  const { data, error } = await supabase
    .from("workspaces")
    .update({
      name,
      description,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log activity
  const { data: userData } = await admin.auth.admin.getUserById(user.id);
  const userName = userData?.user?.user_metadata?.full_name || userData?.user?.email || "Unknown";
  await logActivity(supabase, params.id, user.id, WorkspaceActions.WORKSPACE_UPDATED, {
    metadata: { user_name: userName, new_name: name },
  });

  return NextResponse.json({ workspace: data });
}

// ── DELETE /api/workspace/[id] ───────────────────────────────
// Delete workspace entirely (owner only)
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const parsedParams = parseRouteParams(await props.params, idParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getUserRole(supabase, params.id, user.id);
  if (!role || !canDeleteWorkspace(role)) {
    return NextResponse.json({ error: "Only the workspace owner can delete the workspace." }, { status: 403 });
  }

  // Deleting the workspace cascades to members, drafts, comments, activity log
  const { error } = await supabase
    .from("workspaces")
    .delete()
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
