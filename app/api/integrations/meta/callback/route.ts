import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { saveLocalMetaAccount } from "@/lib/integrations/local-social-accounts";
import { upsertSocialAccount } from "@/lib/integrations/upsert-social-account";
import { readOAuthCallbackParams } from "@/lib/validation/oauth";
import {
  exchangeForLongLivedMetaToken,
  exchangeMetaCode,
  FACEBOOK_PLATFORM,
  fetchInstagramAccountForPage,
  fetchMetaPages,
  fetchMetaPermissions,
  getTokenExpiry,
  INSTAGRAM_PLATFORM,
  META_SCOPES
} from "@/lib/integrations/meta";

export const dynamic = "force-dynamic";

type MetaPlatformIntent = "facebook" | "instagram" | null;

function dashboardRedirect(
  origin: string,
  status: "connected" | "error" | "disconnected",
  message?: string,
  platform?: MetaPlatformIntent,
  workspaceId?: string | null
) {
  const redirectUrl = new URL(workspaceId ? "/team" : "/dashboard", origin);
  redirectUrl.searchParams.set("meta", status);

  if (platform) {
    redirectUrl.searchParams.set("platform", platform);
  }

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
    return JSON.parse(rawCookie) as { state?: string; userId?: string; platform?: MetaPlatformIntent; workspaceId?: string | null };
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
    response.cookies.delete("postelligence_meta_oauth_state");
    return response;
  };

  if (oauthError) {
    return redirectWithClearedState(
      dashboardRedirect(requestUrl.origin, "error", `Meta authorization failed: ${oauthError}`)
    );
  }

  if (!code || !state) {
    return redirectWithClearedState(
      dashboardRedirect(requestUrl.origin, "error", "The Meta callback was missing required OAuth data.")
    );
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/", requestUrl.origin));
  }

  const cookieState = readStateCookie((await cookies()).get("postelligence_meta_oauth_state")?.value);
  const platformIntent =
    cookieState?.platform === "facebook" || cookieState?.platform === "instagram"
      ? cookieState.platform
      : null;

  if (cookieState?.state !== state || cookieState?.userId !== user.id) {
    return redirectWithClearedState(
      dashboardRedirect(
        requestUrl.origin,
        "error",
        "The Meta authorization session expired. Try connecting again.",
        platformIntent,
        cookieState?.workspaceId
      )
    );
  }

  // Present only when connecting from the Team Workspace Accounts tab.
  // Pages/Instagram accounts are then owned by the workspace, not this member.
  const workspaceId = cookieState?.workspaceId || null;

  try {
    const shortLivedToken = await exchangeMetaCode(requestUrl.origin, code);
    const longLivedToken = await exchangeForLongLivedMetaToken(shortLivedToken.access_token);
    const userAccessToken = longLivedToken.access_token;
    const tokenExpiresAt = getTokenExpiry(longLivedToken.expires_in);
    const pages = await fetchMetaPages(userAccessToken);

    if (pages.length === 0) {
      const permissions = await fetchMetaPermissions(userAccessToken);
      const missingScopes = META_SCOPES.filter((scope) => {
        const permission = permissions.find((item) => item.permission === scope);
        return permission?.status !== "granted";
      });
      const message =
        missingScopes.length > 0
          ? `No Facebook Pages were returned because Meta did not grant: ${missingScopes.join(", ")}. Reconnect and allow Page and business permissions.`
          : "No Facebook Pages were returned. Make sure your Facebook account has full control of the Page in Meta Business Suite, and that the Page was selected in the Facebook permission dialog.";

      return redirectWithClearedState(
        dashboardRedirect(requestUrl.origin, "error", message, undefined, workspaceId)
      );
    }

    let facebookCount = 0;
    let instagramCount = 0;

    for (const page of pages) {
      const pageAvatar = page.picture?.data?.url || null;

      if (!platformIntent || platformIntent === FACEBOOK_PLATFORM) {
        facebookCount += 1;
        const facebookRecord = {
          user_id: user.id,
          workspace_id: workspaceId,
          connected_by: user.id,
          platform: FACEBOOK_PLATFORM,
          account_id: page.id,
          account_name: page.name,
          account_avatar_url: pageAvatar,
          access_token: page.access_token,
          refresh_token: null,
          token_expires_at: tokenExpiresAt,
          scopes: META_SCOPES,
          status: "connected",
          metadata: page,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error: facebookError } = await upsertSocialAccount(supabase, facebookRecord);

        if (facebookError && !workspaceId) {
          await saveLocalMetaAccount({
            userId: user.id,
            platform: FACEBOOK_PLATFORM,
            accountId: page.id,
            accountName: page.name,
            accountAvatarUrl: pageAvatar,
            accessToken: page.access_token,
            tokenExpiresAt,
            scopes: META_SCOPES,
            metadata: page as unknown as Record<string, unknown>
          });
        }
      }

      const instagramAccount =
        page.instagram_business_account ||
        (await fetchInstagramAccountForPage(page.id, page.access_token));

      if (!instagramAccount?.id) {
        continue;
      }

      if (!platformIntent || platformIntent === INSTAGRAM_PLATFORM) {
        instagramCount += 1;
        const instagramRecord = {
          user_id: user.id,
          workspace_id: workspaceId,
          connected_by: user.id,
          platform: INSTAGRAM_PLATFORM,
          account_id: instagramAccount.id,
          account_name:
            instagramAccount.username ||
            instagramAccount.name ||
            `${page.name} Instagram`,
          account_avatar_url: instagramAccount.profile_picture_url || null,
          access_token: page.access_token,
          refresh_token: null,
          token_expires_at: tokenExpiresAt,
          scopes: META_SCOPES,
          status: "connected",
          metadata: {
            ...instagramAccount,
            facebook_page_id: page.id,
            facebook_page_name: page.name
          },
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error: instagramError } = await upsertSocialAccount(supabase, instagramRecord);

        if (instagramError && !workspaceId) {
          await saveLocalMetaAccount({
            userId: user.id,
            platform: INSTAGRAM_PLATFORM,
            accountId: instagramAccount.id,
            accountName:
              instagramAccount.username ||
              instagramAccount.name ||
              `${page.name} Instagram`,
            accountAvatarUrl: instagramAccount.profile_picture_url || null,
            accessToken: page.access_token,
            tokenExpiresAt,
            scopes: META_SCOPES,
            metadata: {
              ...instagramAccount,
              facebook_page_id: page.id,
              facebook_page_name: page.name
            }
          });
        }
      }
    }

    const message =
      platformIntent === FACEBOOK_PLATFORM
        ? `Connected ${facebookCount} Facebook Page(s).`
        : platformIntent === INSTAGRAM_PLATFORM
          ? instagramCount > 0
            ? `Connected ${instagramCount} Instagram account(s).`
            : "No linked Instagram business account was returned."
          : instagramCount > 0
            ? `Connected ${facebookCount} Facebook Page(s) and ${instagramCount} Instagram account(s).`
            : `Connected ${facebookCount} Facebook Page(s). No linked Instagram business account was returned.`;

    return redirectWithClearedState(dashboardRedirect(requestUrl.origin, "connected", message, platformIntent, workspaceId));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Meta connection failed. Try again.";

    return redirectWithClearedState(dashboardRedirect(requestUrl.origin, "error", message, undefined, workspaceId));
  }
}