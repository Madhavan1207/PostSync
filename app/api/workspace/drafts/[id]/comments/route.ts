import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity, WorkspaceActions } from "@/lib/workspace/activity-logger";
import { canComment, getRoleLabel } from "@/lib/workspace/permissions";
import { z } from "zod";
import { parseJsonBody, parseRouteParams } from "@/lib/validation/http";
import { idParams, nonEmptyString } from "@/lib/validation/schemas";
import type { WorkspaceRole } from "@/types";

export const dynamic = "force-dynamic";

/** An empty comment was already a 400; `content` is `text NOT NULL`. */
const CreateCommentBody = z.object({
  content: nonEmptyString(5_000),
});

// ── GET /api/workspace/drafts/[id]/comments ──────────────────
// Get all comments for a workspace draft
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
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!membership) return NextResponse.json({ error: "Not in a workspace." }, { status: 403 });

  const { data: comments, error } = await supabase
    .from("workspace_draft_comments")
    .select("*")
    .eq("draft_id", params.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Role of each commenter, so the thread can show "Madhavan (Owner)"
  // instead of just a name — pull every member's role for this workspace
  // once, rather than a query per comment.
  const { data: roleRows } = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", membership.workspace_id);
  const roleByUserId = new Map((roleRows || []).map((r) => [r.user_id, r.role as WorkspaceRole]));

  // Enrich with user info
  const enriched = await Promise.all(
    (comments || []).map(async (comment) => {
      const { data: userData } = await admin.auth.admin.getUserById(comment.user_id);
      const role = roleByUserId.get(comment.user_id);
      return {
        ...comment,
        user_name:   userData?.user?.user_metadata?.full_name || userData?.user?.email || "Unknown",
        user_avatar: userData?.user?.user_metadata?.avatar_url || "",
        user_role:   role ? getRoleLabel(role) : null,
      };
    })
  );

  return NextResponse.json({ comments: enriched });
}

// ── POST /api/workspace/drafts/[id]/comments ─────────────────
// Add a comment to a workspace draft
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const parsedParams = parseRouteParams(await props.params, idParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const admin    = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!membership) return NextResponse.json({ error: "Not in a workspace." }, { status: 403 });

  if (!canComment(membership.role as WorkspaceRole)) {
    return NextResponse.json({ error: "Analysts cannot add comments." }, { status: 403 });
  }

  const parsed = await parseJsonBody(req, CreateCommentBody);
  if (!parsed.success) return parsed.response;
  const { content } = parsed.data;

  const { data: comment, error } = await supabase
    .from("workspace_draft_comments")
    .insert({
      draft_id: params.id,
      user_id:  user.id,
      content,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with user info
  const { data: userData } = await admin.auth.admin.getUserById(user.id);
  const userName   = userData?.user?.user_metadata?.full_name || userData?.user?.email || "Unknown";
  const avatarUrl  = userData?.user?.user_metadata?.avatar_url || "";

  // Log activity
  await logActivity(supabase, membership.workspace_id, user.id, WorkspaceActions.COMMENT_ADDED, {
    entityType: "workspace_draft",
    entityId:   params.id,
    metadata:   { user_name: userName },
  });

  return NextResponse.json({
    comment: { ...comment, user_name: userName, user_avatar: avatarUrl, user_role: getRoleLabel(membership.role as WorkspaceRole) },
  }, { status: 201 });
}
