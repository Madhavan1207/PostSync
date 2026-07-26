import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity, WorkspaceActions } from "@/lib/workspace/activity-logger";
import { getMemberIdsByRole, notifyWorkspaceUsers } from "@/lib/workspace/notifications";
import { parseJsonBody } from "@/lib/validation/http";

export const dynamic = "force-dynamic";

/**
 * NOT a UUID — `workspace_invites.token` defaults to
 * `encode(gen_random_bytes(32), 'hex')`, i.e. 64 lowercase hex characters.
 */
const RejectInviteBody = z.object({
  token: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/, "Invalid invite token."),
});

// ── POST /api/workspace/invite/reject ───────────────────────
// Reject an invite token — marks it rejected. Must NOT add the
// user to the workspace or mark it accepted (that's the accept
// route's job). This route previously was a copy-paste of the
// accept route and ended up doing exactly that.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await parseJsonBody(req, RejectInviteBody, {
    message: "Token is required.",
  });
  if (!parsed.success) return parsed.response;
  const { token } = parsed.data;

  // Validate the invite — must belong to this user's email, and not
  // already accepted/rejected/expired.
  const { data: invite, error: inviteError } = await supabase
    .from("workspace_invites")
    .select("id, email, workspace_id, role, invited_by")
    .eq("token", token)
    .eq("email", user.email)
    .eq("accepted", false)
    .eq("rejected", false)
    .gte("expires_at", new Date().toISOString())
    .single();

  if (inviteError || !invite) {
    return NextResponse.json(
      { error: "Invite not found or has expired." },
      { status: 404 }
    );
  }

  // Mark the invite as rejected only. Do not touch workspace_members —
  // rejecting must never grant workspace access.
  const { error: updateError } = await supabase
    .from("workspace_invites")
    .update({ rejected: true })
    .eq("id", invite.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Previously a decline was completely silent — the invite just sat in
  // the "Pending" list forever looking identical to one nobody had
  // responded to yet. Log it (shows in the Team activity feed) and push
  // an actual notification to whoever can see/manage invites (the
  // person who sent it, plus every Owner — an Owner should always know
  // when someone turns down a seat on their team, not just whoever
  // happened to send it).
  const admin = createAdminClient();
  const { data: userData } = await admin.auth.admin.getUserById(user.id);
  const userName = userData?.user?.user_metadata?.full_name || userData?.user?.email || invite.email;

  await logActivity(supabase, invite.workspace_id, user.id, WorkspaceActions.INVITE_REJECTED, {
    entityType: "workspace_invite",
    entityId:   invite.id,
    metadata:   { user_name: userName, target_name: invite.role },
  });

  const ownerIds = await getMemberIdsByRole(supabase, invite.workspace_id, ["owner"]);
  const recipientIds = new Set(ownerIds);
  if (invite.invited_by) recipientIds.add(invite.invited_by);

  await notifyWorkspaceUsers(
    invite.workspace_id,
    Array.from(recipientIds),
    "invite_rejected",
    "Invite declined",
    `${userName} declined the invite to join as ${invite.role}.`,
    { entityType: "workspace_invite", entityId: invite.id }
  );

  return NextResponse.json({ success: true });
}