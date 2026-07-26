import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity, WorkspaceActions } from "@/lib/workspace/activity-logger";
import { z } from "zod";
import { canManageMembers } from "@/lib/workspace/permissions";
import { parseJsonBody, parseRouteParams } from "@/lib/validation/http";
import { emailAddress, idParams, workspaceRole } from "@/lib/validation/schemas";
import type { WorkspaceRole } from "@/types";

export const dynamic = "force-dynamic";

/**
 * `owner` is excluded rather than using the bare `workspaceRole` enum: the
 * `workspace_invites.role` CHECK constraint only permits manager/creator/analyst,
 * and ownership is only ever moved via the transfer route.
 */
const InviteMemberBody = z.object({
  email: emailAddress.max(320),
  role: workspaceRole.exclude(["owner"]),
});

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

// ── GET /api/workspace/[id]/members ─────────────────────────
// Returns all members with their email and display name
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const parsedParams = parseRouteParams(await props.params, idParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const admin    = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Must be a member of this workspace
  const role = await getUserRole(supabase, params.id, user.id);
  if (!role) return NextResponse.json({ error: "Not a member of this workspace." }, { status: 403 });

  const { data: members, error } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", params.id)
    .order("joined_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with user info from auth.users via admin client
  const enriched = await Promise.all(
    (members || []).map(async (m) => {
      const { data: userData } = await admin.auth.admin.getUserById(m.user_id);
      return {
        ...m,
        email:      userData?.user?.email ?? "",
        full_name:  userData?.user?.user_metadata?.full_name ?? "",
        avatar_url: userData?.user?.user_metadata?.avatar_url ?? "",
      };
    })
  );

  // Also fetch pending invites (owner/manager only)
  let invites: unknown[] = [];
  if (role === "owner" || role === "manager") {
    const { data: inviteData } = await supabase
      .from("workspace_invites")
      .select("*")
      .eq("workspace_id", params.id)
      .eq("accepted", false)
      .eq("rejected", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    invites = inviteData || [];
  }

  return NextResponse.json({ members: enriched, invites });
}

// ── POST /api/workspace/[id]/members ────────────────────────
// Invite a user by email (owner/manager only)
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const parsedParams = parseRouteParams(await props.params, idParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const admin    = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getUserRole(supabase, params.id, user.id);
  if (!role || !canManageMembers(role)) {
    return NextResponse.json({ error: "Only the workspace owner can invite members." }, { status: 403 });
  }

  const parsed = await parseJsonBody(req, InviteMemberBody);
  if (!parsed.success) return parsed.response;
  const { email, role: inviteRole } = parsed.data;

  // The invited email must belong to an existing Postelligence account —
  // we never fire off an invite (or email) to an address that hasn't
  // signed up. listUsers() paginates at 50 by default, so page through
  // it rather than trusting the first page to contain the match.
  // `emailAddress` has already trimmed and lower-cased the value.
  const normalizedEmail = email;
  let invitedUser: { id: string; email?: string } | undefined;
  for (let page = 1; !invitedUser; page++) {
    const { data: pageData, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }
    invitedUser = pageData?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);
    if (!pageData?.users?.length || pageData.users.length < 200) break; // last page
  }

  if (!invitedUser) {
    return NextResponse.json(
      { error: "No Postelligence account exists for this email. They need to sign up before you can invite them." },
      { status: 404 }
    );
  }

  const { data: existingMember } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", params.id)
    .eq("user_id", invitedUser.id)
    .single();

  if (existingMember) {
    return NextResponse.json({ error: "This user is already a member of the workspace." }, { status: 400 });
  }

  // Use the account's actual email on file (not whatever casing/whitespace
  // the inviter typed) so it lines up exactly with the invitee's JWT email
  // that the "invites addressed to me" RLS policy and notification bell
  // match against.
  const accountEmail = invitedUser.email ?? normalizedEmail;

  // Check for existing pending invite
  const { data: existingInvite } = await supabase
    .from("workspace_invites")
    .select("id")
    .eq("workspace_id", params.id)
    .eq("email", accountEmail)
    .eq("accepted", false)
    .eq("rejected", false)
    .gte("expires_at", new Date().toISOString())
    .single();

  if (existingInvite) {
    return NextResponse.json({ error: "An invite has already been sent to this email." }, { status: 400 });
  }

  // Create the invite
  const { data: invite, error: inviteError } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: params.id,
      email:        accountEmail,
      role:         inviteRole,
      invited_by:   user.id,
    })
    .select()
    .single();

  if (inviteError || !invite) {
    return NextResponse.json({ error: inviteError?.message || "Failed to create invite." }, { status: 500 });
  }

  // Log activity
  const { data: userData } = await admin.auth.admin.getUserById(user.id);
  const userName = userData?.user?.user_metadata?.full_name || userData?.user?.email || "Unknown";
  await logActivity(supabase, params.id, user.id, WorkspaceActions.MEMBER_INVITED, {
    metadata: { user_name: userName, target_name: accountEmail, role: inviteRole },
  });

  // Return invite with the token so the frontend can generate the invite link
  return NextResponse.json({ invite }, { status: 201 });
}
