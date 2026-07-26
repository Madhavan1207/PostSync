import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { upsertSocialAccount } from "@/lib/integrations/upsert-social-account";
import { readOAuthCallbackParams } from "@/lib/validation/oauth";
import {
  DIRECT_INSTAGRAM_PLATFORM,
  exchangeForLongLivedInstagramToken,
  exchangeInstagramCode,
  fetchInstagramProfile,
  getInstagramTokenExpiry,
  INSTAGRAM_SCOPES
} from "@/lib/integrations/instagram";

export const dynamic = "force-dynamic";

function readStateCookie(rawCookie?: string) {
  if (!rawCookie) {
    return null;
  }

  try {
    return JSON.parse(rawCookie) as {
      state?: string;
      userId?: string;
      workspaceId?: string | null;
    };
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

  const redirect = (
    status: "connected" | "error",
    message?: string,
    workspaceId?: string | null
  ) => {
    const url = new URL(
      workspaceId ? "/team" : "/dashboard",
      requestUrl.origin
    );

    url.searchParams.set("instagram", status);

    if (message) {
      url.searchParams.set("message", message);
    }

    const response = NextResponse.redirect(url);
    response.cookies.delete("postelligence_instagram_oauth_state");

    return response;
  };

  if (oauthError) {
    return redirect(
      "error",
      `Instagram authorization failed: ${oauthError}`
    );
  }

  if (!code || !state) {
    return redirect(
      "error",
      "The Instagram callback was missing required OAuth data."
    );
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/", requestUrl.origin));
  }

  const cookieState = readStateCookie(
    (await cookies()).get("postelligence_instagram_oauth_state")?.value
  );

  if (
    cookieState?.state !== state ||
    cookieState?.userId !== user.id
  ) {
    return redirect(
      "error",
      "The Instagram authorization session expired. Try connecting again.",
      cookieState?.workspaceId
    );
  }

  const workspaceId = cookieState?.workspaceId || null;

  try {
        const shortLivedToken = await exchangeInstagramCode(
      requestUrl.origin,
      code
    );

    const longLivedToken =
      await exchangeForLongLivedInstagramToken(
        shortLivedToken.access_token
      );

    const accessToken = longLivedToken.access_token;

    const tokenExpiresAt = getInstagramTokenExpiry(
      longLivedToken.expires_in
    );

    const profile = await fetchInstagramProfile(accessToken);

    const accountName =
      profile.username ||
      profile.name ||
      `Instagram ${profile.id}`;

    const ownerFilter = workspaceId
      ? supabase
          .from("social_accounts")
          .select("id, refresh_token")
          .eq("workspace_id", workspaceId)
      : supabase
          .from("social_accounts")
          .select("id, refresh_token")
          .eq("user_id", user.id)
          .is("workspace_id", null);

    const { data: existing } = await ownerFilter
      .eq("platform", DIRECT_INSTAGRAM_PLATFORM)
      .eq("account_id", profile.id)
      .maybeSingle();

    await upsertSocialAccount(supabase, {
      user_id: user.id,
      workspace_id: workspaceId,
      connected_by: user.id,

      platform: DIRECT_INSTAGRAM_PLATFORM,

      account_id: profile.id,

      account_name: accountName,

      account_avatar_url:
        profile.profile_picture_url || null,

      access_token: accessToken,

      refresh_token:
        existing?.refresh_token || null,

      token_expires_at: tokenExpiresAt,

      scopes: INSTAGRAM_SCOPES,

      status: "connected",

      metadata: {
        ...profile,
        login_type: "instagram"
      },

      connected_at: new Date().toISOString(),

      updated_at: new Date().toISOString()
    });

    return redirect(
      "connected",
      `Connected Instagram account @${accountName.replace(
        /^@/,
        ""
      )}.`,
      workspaceId
    );
      } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Instagram connection failed. Try again.";

    return redirect(
      "error",
      message,
      workspaceId
    );
  }
}