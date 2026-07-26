import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { saveLocalYouTubeAccount } from "@/lib/integrations/local-social-accounts";
import { upsertSocialAccount } from "@/lib/integrations/upsert-social-account";
import { readOAuthCallbackParams } from "@/lib/validation/oauth";
import {
  exchangeYouTubeCode,
  fetchYouTubeChannel,
  getTokenExpiry,
  YOUTUBE_PLATFORM,
  YOUTUBE_SCOPES
} from "@/lib/integrations/youtube";

export const dynamic = "force-dynamic";

function dashboardRedirect(origin: string, status: "connected" | "error", message?: string, workspaceId?: string | null) {
  const redirectUrl = new URL(workspaceId ? "/team" : "/dashboard", origin);
  redirectUrl.searchParams.set("youtube", status);

  if (message) {
    redirectUrl.searchParams.set("message", message);
  }

  return redirectUrl;
}

function readStateCookie(rawCookie?: string) {
  if (!rawCookie) {
    return null;
  }

  try {
    return JSON.parse(rawCookie) as { state?: string; userId?: string; workspaceId?: string | null };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  // Validated and bounded; an invalid value reads as null so the existing
  // "missing OAuth data" redirect below handles it exactly as before.
  const { code, state, error: oauthError } = readOAuthCallbackParams(requestUrl);
  const supabase = await createClient();

  const redirectWithClearedState = (url: URL) => {
    const response = NextResponse.redirect(url);
    response.cookies.delete("postelligence_youtube_oauth_state");
    return response;
  };

  if (oauthError) {
    return redirectWithClearedState(
      dashboardRedirect(requestUrl.origin, "error", `Google authorization failed: ${oauthError}`)
    );
  }

  if (!code || !state) {
    return redirectWithClearedState(
      dashboardRedirect(requestUrl.origin, "error", "The YouTube callback was missing required OAuth data.")
    );
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/", requestUrl.origin));
  }

  const cookieState = readStateCookie((await cookies()).get("postelligence_youtube_oauth_state")?.value);

  if (cookieState?.state !== state || cookieState?.userId !== user.id) {
    return redirectWithClearedState(
      dashboardRedirect(requestUrl.origin, "error", "The YouTube authorization session expired. Try connecting again.", cookieState?.workspaceId)
    );
  }

  // Present only when connecting from the Team Workspace Accounts tab.
  // The channel is then owned by the workspace, not this member.
  const workspaceId = cookieState.workspaceId || null;

  try {
    const tokens = await exchangeYouTubeCode(requestUrl.origin, code);
    const channel = await fetchYouTubeChannel(tokens.access_token);

    const ownerFilter = workspaceId
      ? supabase.from("social_accounts").select("id, refresh_token").eq("workspace_id", workspaceId)
      : supabase.from("social_accounts").select("id, refresh_token").eq("user_id", user.id).is("workspace_id", null);

    const { data: existingAccount } = await ownerFilter
      .eq("platform", YOUTUBE_PLATFORM)
      .eq("account_id", channel.id)
      .maybeSingle();

    const accountRecord = {
      user_id: user.id,
      workspace_id: workspaceId,
      connected_by: user.id,
      platform: YOUTUBE_PLATFORM,
      account_id: channel.id,
      account_name: channel.name,
      account_avatar_url: channel.thumbnailUrl,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || existingAccount?.refresh_token || null,
      token_expires_at: getTokenExpiry(tokens.expires_in),
      scopes: tokens.scope?.split(" ") || YOUTUBE_SCOPES,
      status: "connected",
      metadata: channel.raw,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await upsertSocialAccount(supabase, accountRecord);

    if (error && !workspaceId) {
      await saveLocalYouTubeAccount({
        userId: user.id,
        accountId: channel.id,
        accountName: channel.name,
        accountAvatarUrl: channel.thumbnailUrl,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        tokenExpiresAt: getTokenExpiry(tokens.expires_in),
        scopes: tokens.scope?.split(" ") || YOUTUBE_SCOPES,
        metadata: channel.raw as Record<string, unknown>
      });
    }

    return redirectWithClearedState(dashboardRedirect(requestUrl.origin, "connected", undefined, workspaceId));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "YouTube connection failed. Try again.";

    return redirectWithClearedState(dashboardRedirect(requestUrl.origin, "error", message, workspaceId));
  }
}