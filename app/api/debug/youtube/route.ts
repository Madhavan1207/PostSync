import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { refreshYouTubeAccessToken } from "@/lib/integrations/youtube";
import { parseSearchParams } from "@/lib/validation/http";
import { uuid } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/** `post_id` is a `scheduled_posts` primary key, so it must be a UUID. */
const DebugYouTubeQuery = z.object({ post_id: uuid });

// GET /api/debug/youtube?post_id=xxx  — call this manually to see exact error
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedQuery = parseSearchParams(req.nextUrl, DebugYouTubeQuery);
  if (!parsedQuery.success) return parsedQuery.response;
  const postId = parsedQuery.data.post_id;

  const { data: post } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("id", postId)
    .eq("user_id", user.id)
    .single();

  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const { data: account } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("user_id", user.id)
    .eq("platform", "youtube")
    .eq("status", "connected")
    .single();

  if (!account) return NextResponse.json({ error: "YouTube account not connected" }, { status: 400 });

  const debug: Record<string, unknown> = {
    post_id: post.id,
    youtube_video_id: post.youtube_video_id,
    has_refresh_token: !!account.refresh_token,
    token_expires_at: account.token_expires_at,
  };

  // Try refreshing token
  let accessToken = account.access_token;
  try {
    const tokens = await refreshYouTubeAccessToken(account.refresh_token);
    accessToken = tokens.access_token;
    debug.token_refresh = "success";
  } catch (e) {
    debug.token_refresh = `failed: ${e instanceof Error ? e.message : e}`;
  }

  if (!post.youtube_video_id) {
    return NextResponse.json({ ...debug, error: "No youtube_video_id on this post" });
  }

  // Try the actual make-public call
  const res = await fetch("https://www.googleapis.com/youtube/v3/videos?part=status", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      kind: "youtube#video",
      id: post.youtube_video_id,
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
    }),
  });

  const responseText = await res.text();
  debug.youtube_api_status = res.status;
  debug.youtube_api_response = responseText;

  return NextResponse.json(debug);
}