import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity, WorkspaceActions } from "@/lib/workspace/activity-logger";
import { canEditDraft, canDeleteDraft } from "@/lib/workspace/permissions";
import { z } from "zod";
import { parseJsonBody, parseRouteParams } from "@/lib/validation/http";
import { httpUrl, idParams, platformId } from "@/lib/validation/schemas";
import type { WorkspaceRole } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Compose sends all four fields on every save, but each stays optional: the
 * handler falls back to the draft's current value for anything missing, so a
 * partial PATCH is already meaningful. `description` is a plain optional
 * string, not `optionalString()` — the column is `text NOT NULL DEFAULT ''`
 * and "" is how the caption gets cleared.
 */
const UpdateDraftBody = z.object({
  title: z.string().trim().max(500, "Must be 500 characters or fewer.").optional(),
  description: z.string().trim().max(20_000, "Must be 20000 characters or fewer.").optional(),
  media_urls: z.array(httpUrl.max(2_048, "Must be 2048 characters or fewer.")).max(20, "At most 20 media items.").optional(),
  platforms: z.array(platformId).max(20, "Too many platforms.").optional(),
});

async function getMembershipAndDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  draftId: string
) {
  const [{ data: membership }, { data: draft }] = await Promise.all([
    supabase.from("workspace_members").select("*").eq("user_id", userId).single(),
    supabase.from("workspace_drafts").select("*").eq("id", draftId).single(),
  ]);
  return { membership, draft };
}

// ── GET /api/workspace/drafts/[id] ──────────────────────────
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const parsedParams = parseRouteParams(await props.params, idParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const admin    = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { membership, draft } = await getMembershipAndDraft(supabase, user.id, params.id);
  if (!membership) return NextResponse.json({ error: "Not in a workspace." }, { status: 403 });
  if (!draft || draft.workspace_id !== membership.workspace_id) {
    return NextResponse.json({ error: "Draft not found." }, { status: 404 });
  }

  // Enrich with creator info
  const { data: creatorData } = await admin.auth.admin.getUserById(draft.created_by);
  const enriched = {
    ...draft,
    creator_name:   creatorData?.user?.user_metadata?.full_name || creatorData?.user?.email || "Unknown",
    creator_avatar: creatorData?.user?.user_metadata?.avatar_url || "",
  };

  return NextResponse.json({ draft: enriched });
}

// ── PATCH /api/workspace/drafts/[id] ────────────────────────
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const parsedParams = parseRouteParams(await props.params, idParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const admin    = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { membership, draft } = await getMembershipAndDraft(supabase, user.id, params.id);
  if (!membership) return NextResponse.json({ error: "Not in a workspace." }, { status: 403 });
  if (!draft || draft.workspace_id !== membership.workspace_id) {
    return NextResponse.json({ error: "Draft not found." }, { status: 404 });
  }

  if (!canEditDraft(membership.role as WorkspaceRole)) {
    return NextResponse.json({ error: "You don't have permission to edit drafts." }, { status: 403 });
  }

  // Creators can only edit their own drafts
  if (membership.role === "creator" && draft.created_by !== user.id) {
    return NextResponse.json({ error: "You can only edit your own drafts." }, { status: 403 });
  }

  // Cannot edit approved/published/scheduled drafts — except the Owner,
  // whose "Edit Post" is explicitly allowed at any stage (e.g. fixing a
  // typo in an already-approved or already-scheduled post). A published
  // post's original record can still be corrected for the archive, but
  // editing it here does not retroactively change what was already sent
  // to the platforms.
  if (membership.role !== "owner" && ["approved", "published", "scheduled"].includes(draft.status)) {
    return NextResponse.json({ error: `Cannot edit a draft with status: ${draft.status}` }, { status: 400 });
  }

  const parsed = await parseJsonBody(req, UpdateDraftBody);
  if (!parsed.success) return parsed.response;
  const { title, description, media_urls, platforms } = parsed.data;

  const { data: updated, error } = await supabase
    .from("workspace_drafts")
    .update({
      title:       title?.trim() || draft.title,
      description: description ?? draft.description,
      media_urls:  media_urls  ?? draft.media_urls,
      platforms:   platforms   ?? draft.platforms,
      updated_at:  new Date().toISOString(),
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log activity
  const { data: userData } = await admin.auth.admin.getUserById(user.id);
  const userName = userData?.user?.user_metadata?.full_name || userData?.user?.email || "Unknown";
  await logActivity(supabase, membership.workspace_id, user.id, WorkspaceActions.DRAFT_EDITED, {
    entityType: "workspace_draft",
    entityId:   params.id,
    metadata:   { user_name: userName, target_name: updated.title },
  });

  return NextResponse.json({ draft: updated });
}

// ── DELETE /api/workspace/drafts/[id] ───────────────────────
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const parsedParams = parseRouteParams(await props.params, idParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const admin    = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { membership, draft } = await getMembershipAndDraft(supabase, user.id, params.id);
  if (!membership) return NextResponse.json({ error: "Not in a workspace." }, { status: 403 });
  if (!draft || draft.workspace_id !== membership.workspace_id) {
    return NextResponse.json({ error: "Draft not found." }, { status: 404 });
  }

  if (!canDeleteDraft(membership.role as WorkspaceRole)) {
    return NextResponse.json({ error: "You don't have permission to delete drafts." }, { status: 403 });
  }

  // Creators can only delete their own drafts
  if (membership.role === "creator" && draft.created_by !== user.id) {
    return NextResponse.json({ error: "You can only delete your own drafts." }, { status: 403 });
  }

  // If this draft is scheduled, cancel its pending job first — otherwise
  // the scheduler could still publish it later even though the draft
  // (and any record of what it was) is gone.
  if (draft.status === "scheduled") {
    await supabase
      .from("scheduled_posts")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("workspace_draft_id", draft.id)
      .eq("status", "pending");
  }

  const { error } = await supabase
    .from("workspace_drafts")
    .delete()
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log activity
  const { data: userData } = await admin.auth.admin.getUserById(user.id);
  const userName = userData?.user?.user_metadata?.full_name || userData?.user?.email || "Unknown";
  await logActivity(supabase, membership.workspace_id, user.id, WorkspaceActions.DRAFT_DELETED, {
    entityType: "workspace_draft",
    entityId:   params.id,
    metadata:   { user_name: userName, target_name: draft.title },
  });

  return NextResponse.json({ success: true });
}
