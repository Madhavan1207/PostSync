import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity, WorkspaceActions } from "@/lib/workspace/activity-logger";
import { canCreateDraft } from "@/lib/workspace/permissions";
import { z } from "zod";
import { parseJsonBody, parseSearchParams } from "@/lib/validation/http";
import { httpUrl, platformId, workspaceDraftStatus } from "@/lib/validation/schemas";
import type { WorkspaceRole } from "@/types";

export const dynamic = "force-dynamic";

const ListDraftsQuery = z.object({
  status: workspaceDraftStatus.optional(),
});

/**
 * All fields optional — the handler defaults each one (`title` falls back to
 * "Untitled", the rest to ""/[]), so a blank draft is a valid save. `title`
 * and `description` are plain optional strings rather than `optionalString()`
 * because both columns are `text NOT NULL DEFAULT ''` and "" clears them.
 */
const CreateDraftBody = z.object({
  title: z.string().trim().max(500, "Must be 500 characters or fewer.").optional(),
  description: z.string().trim().max(20_000, "Must be 20000 characters or fewer.").optional(),
  media_urls: z.array(httpUrl.max(2_048, "Must be 2048 characters or fewer.")).max(20, "At most 20 media items.").optional(),
  platforms: z.array(platformId).max(20, "Too many platforms.").optional(),
});

async function getUserMembership(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("workspace_members")
    .select("*, workspace:workspaces(*)")
    .eq("user_id", userId)
    .single();
  return data;
}

// ── GET /api/workspace/drafts ────────────────────────────────
// List workspace drafts — filterable by status
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const admin    = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await getUserMembership(supabase, user.id);
  if (!membership) return NextResponse.json({ error: "Not in a workspace." }, { status: 403 });

  const parsedQuery = parseSearchParams(req.url, ListDraftsQuery);
  if (!parsedQuery.success) return parsedQuery.response;
  const status = parsedQuery.data.status;

  let query = supabase
    .from("workspace_drafts")
    .select("*")
    .eq("workspace_id", membership.workspace_id)
    .order("updated_at", { ascending: false });

  if (status) query = query.eq("status", status);

  // Creators only see their own drafts
  if (membership.role === "creator") {
    query = query.eq("created_by", user.id);
  }

  const { data: drafts, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with creator info
  const enriched = await Promise.all(
    (drafts || []).map(async (draft) => {
      const { data: creatorData } = await admin.auth.admin.getUserById(draft.created_by);
      return {
        ...draft,
        creator_name:   creatorData?.user?.user_metadata?.full_name || creatorData?.user?.email || "Unknown",
        creator_avatar: creatorData?.user?.user_metadata?.avatar_url || "",
      };
    })
  );

  return NextResponse.json({ drafts: enriched });
}

// ── POST /api/workspace/drafts ───────────────────────────────
// Create a new workspace draft
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const admin    = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await getUserMembership(supabase, user.id);
  if (!membership) return NextResponse.json({ error: "Not in a workspace." }, { status: 403 });

  if (!canCreateDraft(membership.role as WorkspaceRole)) {
    return NextResponse.json({ error: "Only the workspace Owner or a Creator can start a new draft. Managers review, schedule, and publish once a draft is submitted." }, { status: 403 });
  }

  const parsed = await parseJsonBody(req, CreateDraftBody);
  if (!parsed.success) return parsed.response;
  const { title, description, media_urls, platforms } = parsed.data;

  const { data: draft, error } = await supabase
    .from("workspace_drafts")
    .insert({
      workspace_id: membership.workspace_id,
      created_by:   user.id,
      title:        title?.trim() || "Untitled",
      description:  description || "",
      media_urls:   media_urls || [],
      platforms:    platforms || [],
      status:       "draft",
    })
    .select()
    .single();

  if (error || !draft) {
    return NextResponse.json({ error: error?.message || "Failed to create draft." }, { status: 500 });
  }

  // Log activity
  const { data: userData } = await admin.auth.admin.getUserById(user.id);
  const userName = userData?.user?.user_metadata?.full_name || userData?.user?.email || "Unknown";
  await logActivity(supabase, membership.workspace_id, user.id, WorkspaceActions.DRAFT_CREATED, {
    entityType: "workspace_draft",
    entityId:   draft.id,
    metadata:   { user_name: userName, target_name: draft.title },
  });

  return NextResponse.json({ draft }, { status: 201 });
}
