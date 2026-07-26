import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { upsertSocialAccount } from "@/lib/integrations/upsert-social-account";
import { canManageSocialAccounts } from "@/lib/workspace/permissions";
import type { WorkspaceRole } from "@/types";
import { readOAuthCallbackParams } from "@/lib/validation/oauth";
import {
  discordGuildIconUrl,
  DISCORD_PLATFORM,
  DISCORD_SCOPES,
  exchangeDiscordCode,
  fetchDiscordGuilds,
  webhookUrlFromOAuth,
} from "@/lib/integrations/discord";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  let savedState: { state?: string; userId?: string; workspaceId?: string | null } | null = null;
  try {
    const raw = (await cookies()).get("postelligence_discord_oauth_state")?.value;
    savedState = raw ? JSON.parse(raw) : null;
  } catch { /* invalid cookie is handled below */ }
  const destination = savedState?.workspaceId ? "/team?tab=accounts" : "/integrations";
  const redirect = (status: "connected" | "error", message?: string) => {
    const url = new URL(destination, requestUrl.origin);
    url.searchParams.set("discord", status);
    if (message) url.searchParams.set("message", message);
    const response = NextResponse.redirect(url);
    response.cookies.delete("postelligence_discord_oauth_state");
    return response;
  };

  // Validated and bounded; an invalid value reads as null so the existing
  // "missing OAuth data" redirect below handles it exactly as before.
  const { code, state, error: oauthError } = readOAuthCallbackParams(requestUrl);
  if (oauthError) return redirect("error", `Discord authorization failed: ${oauthError}`);
  if (!code || !state) return redirect("error", "Missing Discord authorization data.");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/", requestUrl.origin));

  if (savedState?.state !== state || savedState.userId !== user.id) {
    return redirect("error", "Discord connection session expired. Try again.");
  }

  const workspaceId = savedState.workspaceId || null;
  if (workspaceId) {
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("workspace_id", workspaceId)
      .single();
    if (!membership || !canManageSocialAccounts(membership.role as WorkspaceRole)) {
      return redirect("error", "You can no longer manage this workspace's social accounts.");
    }
  }

  try {
    const token = await exchangeDiscordCode(requestUrl.origin, code);
    const webhookUrl = webhookUrlFromOAuth(token);
    const webhook = token.webhook!;
    const guilds = await fetchDiscordGuilds(token.access_token);
    const guild = guilds.find((item) => item.id === webhook.guild_id);
    const serverName = guild?.name || "Discord server";
    const botName = webhook.name || "Discord webhook";
    const avatarUrl = discordGuildIconUrl(guild) || (webhook.avatar
      ? `https://cdn.discordapp.com/avatars/${webhook.id}/${webhook.avatar}.png?size=128`
      : null);

    await upsertSocialAccount(supabase, {
      user_id: user.id,
      workspace_id: workspaceId,
      connected_by: user.id,
      platform: DISCORD_PLATFORM,
      account_id: webhook.id,
      account_name: `${serverName} · ${botName}`,
      account_avatar_url: avatarUrl,
      access_token: webhookUrl,
      refresh_token: token.refresh_token || null,
      token_expires_at: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
      scopes: DISCORD_SCOPES,
      status: "connected",
      metadata: {
        guildId: webhook.guild_id,
        guildName: serverName,
        channelId: webhook.channel_id,
        botName,
        oauth: true,
      },
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return redirect("connected");
  } catch (error) {
    return redirect("error", error instanceof Error ? error.message : "Discord connection failed.");
  }
}
