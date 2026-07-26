import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { upsertSocialAccount } from "@/lib/integrations/upsert-social-account";
import { readOAuthCallbackParams } from "@/lib/validation/oauth";
import {
  exchangeThreadsCode,
  exchangeForLongLivedThreadsToken,
  fetchThreadsUser,
  getThreadsTokenExpiry,
  THREADS_PLATFORM,
  THREADS_SCOPES
} from "@/lib/integrations/threads";

export const dynamic = "force-dynamic";

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

    url.searchParams.set("threads", status);

    if (message) {
      url.searchParams.set("message", message);
    }

    const response = NextResponse.redirect(url);
    response.cookies.delete("postelligence_threads_oauth_state");

    return response;
  };

  if (oauthError) {
    return redirect(
      "error",
      `Threads authorization failed: ${oauthError}`
    );
  }

  if (!code || !state) {
    return redirect(
      "error",
      "Missing OAuth data."
    );
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/", requestUrl.origin));
  }

  const raw = (await cookies()).get("postelligence_threads_oauth_state")?.value;

  let cookieState: {
    state?: string;
    userId?: string;
    workspaceId?: string | null;
  } | null = null;

  try {
    cookieState = raw ? JSON.parse(raw) : null;
  } catch {
    cookieState = null;
  }

  if (
    cookieState?.state !== state ||
    cookieState?.userId !== user.id
  ) {
    return redirect(
      "error",
      "Session expired. Try connecting again.",
      cookieState?.workspaceId
    );
  }

  const workspaceId = cookieState?.workspaceId || null;

  try {
        const shortToken = await exchangeThreadsCode(
      requestUrl.origin,
      code
    );

    const longToken =
      await exchangeForLongLivedThreadsToken(
        shortToken.access_token
      );

    const threadsUser = await fetchThreadsUser(
      longToken.access_token
    );

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
      .eq("platform", THREADS_PLATFORM)
      .eq("account_id", threadsUser.id)
      .maybeSingle();

    await upsertSocialAccount(supabase, {
      user_id: user.id,
      workspace_id: workspaceId,
      connected_by: user.id,

      platform: THREADS_PLATFORM,

      account_id: threadsUser.id,

      account_name:
        threadsUser.name ||
        threadsUser.username ||
        "Threads Account",

      account_avatar_url:
        threadsUser.threads_profile_picture_url || null,

      access_token: longToken.access_token,

      refresh_token:
        existing?.refresh_token || null,

      token_expires_at: getThreadsTokenExpiry(
        longToken.expires_in
      ),

      scopes: THREADS_SCOPES,

      status: "connected",

      metadata: {
        username: threadsUser.username
      },

      connected_at: new Date().toISOString(),

      updated_at: new Date().toISOString()
    });

    return redirect(
      "connected",
      undefined,
      workspaceId
    );
      } catch (error) {
    return redirect(
      "error",
      error instanceof Error
        ? error.message
        : "Threads connection failed.",
      workspaceId
    );
  }
}