import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity, WorkspaceActions } from "@/lib/workspace/activity-logger";
import { canPublish } from "@/lib/workspace/permissions";
import { z } from "zod";
import { parseOptionalJsonBody, parseRouteParams } from "@/lib/validation/http";
import { idParams, isoDateTime } from "@/lib/validation/schemas";
import type { WorkspaceRole } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Shared by POST (schedule-or-publish-now) and PATCH (reschedule).
 *
 * `scheduled_time` is optional here even though PATCH requires it: on POST its
 * absence is what selects "publish now", and PATCH keeps its own explicit
 * check so the caller still gets the specific "scheduled_time is required."
 * message rather than a generic field error.
 */
const PublishBody = z.object({
  scheduled_time: isoDateTime.optional(),
});

function mediaTypeFor(url: string) {
  return /\.(mp4|mov|webm|avi)(\?|$)/i.test(url) ? "video" : "image";
}

// ── POST /api/workspace/drafts/[id]/publish ─────────────────
// Manager/Owner schedules or immediately publishes an approved workspace
// draft. This always runs through the workspace's connected social
// accounts (see /api/posts/publish's workspace_id branch) — never the
// personal accounts of whoever happens to click the button, regardless
// of who created, approved, or is now scheduling/publishing the draft.
//
// Body: { scheduled_time?: string }
//   - scheduled_time present  -> insert a pending scheduled_posts row,
//                                draft.status = "scheduled"
//   - scheduled_time omitted  -> publish immediately, draft.status =
//                                "published" or "failed"
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

  if (!canPublish(membership.role as WorkspaceRole)) {
    return NextResponse.json({ error: "Only managers and owners can publish or schedule drafts." }, { status: 403 });
  }

  const { data: draft } = await supabase
    .from("workspace_drafts")
    .select("*")
    .eq("id", params.id)
    .eq("workspace_id", membership.workspace_id)
    .single();

  if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });

  if (draft.status !== "approved") {
    return NextResponse.json({ error: "Only approved drafts can be published or scheduled." }, { status: 400 });
  }

  if (!draft.platforms || draft.platforms.length === 0) {
    return NextResponse.json({ error: "This draft has no platforms selected." }, { status: 400 });
  }

  // "Publish Now" sends `{}` and the route already tolerated a bodyless
  // request, so a missing body must stay a publish-now, not a 400.
  const parsed = await parseOptionalJsonBody(req, PublishBody);
  if (!parsed.success) return parsed.response;
  const scheduledTime: string | null = parsed.data.scheduled_time || null;

  const { data: userData } = await admin.auth.admin.getUserById(user.id);
  const userName = userData?.user?.user_metadata?.full_name || userData?.user?.email || "Unknown";

  // ── Schedule for later ──────────────────────────────────────
  if (scheduledTime) {
    // LinkedIn and YouTube both require the video to be uploaded ahead
    // of the scheduled time (LinkedIn's asset registration and YouTube's
    // upload can't happen synchronously inside the publish worker) — do
    // that here, through the workspace's own connected accounts, exactly
    // like solo Compose does before scheduling.
    const mediaUrl = draft.media_urls?.[0] || "";
    const isVideo = mediaUrl ? /\.(mp4|mov|webm|avi)(\?|$)/i.test(mediaUrl) : false;

    let linkedinMediaUrn: string | null = draft.linkedin_media_urn || null;
    if (isVideo && mediaUrl && draft.platforms.includes("linkedin") && !linkedinMediaUrn) {
      const preUploadForm = new FormData();
      preUploadForm.set("mediaUrl", mediaUrl);
      preUploadForm.set("mediaType", "video");
      preUploadForm.set("workspaceId", membership.workspace_id);
      const preUploadRes = await fetch(new URL("/api/media/preupload-linkedin", req.url), {
        method: "POST", body: preUploadForm, headers: { cookie: req.headers.get("cookie") || "" },
      });
      const preUploadData = await preUploadRes.json().catch(() => ({}));
      if (preUploadRes.ok && preUploadData.urn) {
        linkedinMediaUrn = preUploadData.urn;
      } else {
        return NextResponse.json({ error: preUploadData.error || "LinkedIn video pre-upload failed." }, { status: 502 });
      }
    }

    let youtubeVideoId: string | null = draft.youtube_video_id || null;
    if (isVideo && mediaUrl && draft.platforms.includes("youtube") && !youtubeVideoId) {
      const ytForm = new FormData();
      ytForm.set("mediaUrl", mediaUrl);
      ytForm.set("title", draft.title || "Untitled Video");
      ytForm.set("description", draft.description || "");
      ytForm.set("workspaceId", membership.workspace_id);
      const ytRes = await fetch(new URL("/api/media/preupload-youtube", req.url), {
        method: "POST", body: ytForm, headers: { cookie: req.headers.get("cookie") || "" },
      });
      const ytData = await ytRes.json().catch(() => ({}));
      if (ytRes.ok && ytData.videoId) {
        youtubeVideoId = ytData.videoId;
      } else {
        return NextResponse.json({ error: ytData.error || "YouTube video pre-upload failed." }, { status: 502 });
      }
    }

    const { error: insertError } = await supabase.from("scheduled_posts").insert({
      user_id: user.id,
      workspace_id: membership.workspace_id,
      workspace_draft_id: draft.id,
      title: draft.title || "",
      description: draft.description || "",
      media_urls: draft.media_urls || [],
      platforms: draft.platforms,
      scheduled_time: scheduledTime,
      status: "pending",
      linkedin_media_urn: linkedinMediaUrn,
      youtube_video_id: youtubeVideoId,
    });

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    const { data: updated, error } = await supabase
      .from("workspace_drafts")
      .update({
        status:             "scheduled",
        scheduled_time:     scheduledTime,
        linkedin_media_urn: linkedinMediaUrn,
        youtube_video_id:   youtubeVideoId,
        reviewed_by:        user.id,
        reviewed_at:        new Date().toISOString(),
        updated_at:         new Date().toISOString(),
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logActivity(supabase, membership.workspace_id, user.id, WorkspaceActions.DRAFT_SCHEDULED, {
      entityType: "workspace_draft",
      entityId:   params.id,
      metadata:   { user_name: userName, target_name: draft.title },
    });

    return NextResponse.json({ draft: updated });
  }

  // ── Publish Now ──────────────────────────────────────────────
  // Reuse /api/posts/publish's dispatch logic (per-platform posting,
  // retries, media handling) instead of duplicating it — forwarding the
  // workspace_id tells it to resolve the workspace's connected accounts
  // instead of the caller's personal ones.
  const formData = new FormData();
  formData.set("caption", draft.description || "");
  formData.set("title", draft.title || "");
  formData.set("platforms", draft.platforms.join(","));
  formData.set("workspace_id", membership.workspace_id);
  formData.set("workspace_draft_id", draft.id);
  if (draft.media_urls?.[0]) {
    formData.set("mediaUrl", draft.media_urls[0]);
    formData.set("mediaType", mediaTypeFor(draft.media_urls[0]));
    // Everything past the first image — without this only image 1 of a
    // multi-image workspace draft ever went out when hitting "Publish Now".
    const extraMediaUrls = draft.media_urls.slice(1);
    if (extraMediaUrls.length > 0) {
      formData.set("extraMediaUrls", JSON.stringify(extraMediaUrls));
    }
  }

  let publishResults: Array<{ platform: string; status: string; message: string }> = [];
  let publishedCount = 0;
  try {
    const publishRes = await fetch(new URL("/api/posts/publish", req.url), {
      method: "POST",
      body: formData,
      headers: { cookie: req.headers.get("cookie") || "" },
    });
    const publishData = await publishRes.json().catch(() => ({}));
    if (!publishRes.ok) throw new Error(publishData?.error || "Publish failed.");
    publishResults = publishData.results || [];
    publishedCount = publishData.published || 0;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Publish failed." }, { status: 500 });
  }

  const published = publishedCount > 0;
  const firstFailure = publishResults.find((r) => r.status === "failed");

  const { data: updated, error } = await supabase
    .from("workspace_drafts")
    .update({
      status:           published ? "published" : "failed",
      rejection_reason: published ? null : (firstFailure?.message || "Publishing failed."),
      reviewed_by:      user.id,
      reviewed_at:      new Date().toISOString(),
      updated_at:       new Date().toISOString(),
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity(
    supabase,
    membership.workspace_id,
    user.id,
    published ? WorkspaceActions.DRAFT_PUBLISHED : WorkspaceActions.DRAFT_PUBLISH_FAILED,
    {
      entityType: "workspace_draft",
      entityId:   params.id,
      metadata:   { user_name: userName, target_name: draft.title, reason: published ? undefined : firstFailure?.message },
    }
  );

  if (!published) {
    return NextResponse.json({ error: firstFailure?.message || "Publishing failed.", draft: updated, results: publishResults }, { status: 502 });
  }

  return NextResponse.json({ draft: updated, results: publishResults });
}

// ── PATCH /api/workspace/drafts/[id]/publish ────────────────
// Reschedule an already-scheduled draft to a new time.
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const parsedParams = parseRouteParams(await props.params, idParams);
  if (!parsedParams.success) return parsedParams.response;
  const params = parsedParams.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!membership) return NextResponse.json({ error: "Not in a workspace." }, { status: 403 });
  if (!canPublish(membership.role as WorkspaceRole)) {
    return NextResponse.json({ error: "Only managers and owners can reschedule drafts." }, { status: 403 });
  }

  const { data: draft } = await supabase
    .from("workspace_drafts")
    .select("*")
    .eq("id", params.id)
    .eq("workspace_id", membership.workspace_id)
    .single();

  if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });
  if (draft.status !== "scheduled") {
    return NextResponse.json({ error: "Only scheduled drafts can be rescheduled." }, { status: 400 });
  }

  const parsed = await parseOptionalJsonBody(req, PublishBody);
  if (!parsed.success) return parsed.response;
  const scheduledTime: string | null = parsed.data.scheduled_time || null;
  if (!scheduledTime) return NextResponse.json({ error: "scheduled_time is required." }, { status: 400 });

  const { error: updateScheduledPostError } = await supabase
    .from("scheduled_posts")
    .update({ scheduled_time: scheduledTime, updated_at: new Date().toISOString() })
    .eq("workspace_draft_id", draft.id)
    .eq("status", "pending");

  if (updateScheduledPostError) return NextResponse.json({ error: updateScheduledPostError.message }, { status: 500 });

  const { data: updated, error } = await supabase
    .from("workspace_drafts")
    .update({ scheduled_time: scheduledTime, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: userData } = await createAdminClient().auth.admin.getUserById(user.id);
  const userName = userData?.user?.user_metadata?.full_name || userData?.user?.email || "Unknown";
  await logActivity(supabase, membership.workspace_id, user.id, WorkspaceActions.DRAFT_SCHEDULED, {
    entityType: "workspace_draft",
    entityId:   params.id,
    metadata:   { user_name: userName, target_name: draft.title },
  });

  return NextResponse.json({ draft: updated });
}
