import { z } from "zod";
import { parseJsonBody } from "@/lib/validation/http";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchTelegramBotInfo, fetchTelegramChatInfo, TELEGRAM_PLATFORM } from "@/lib/integrations/telegram";
import { upsertSocialAccount } from "@/lib/integrations/upsert-social-account";
import { canManageSocialAccounts } from "@/lib/workspace/permissions";
import type { WorkspaceRole } from "@/types";

/**
 * Telegram bot tokens look like `<bot_id>:<secret>`; chat ids are either a numeric
 * id (possibly negative for groups) or an `@channelname`. Shape-checking both
 * stops a malformed value reaching the Telegram API call.
 */
const TelegramConnectBody = z.object({
  botToken: z
    .string()
    .trim()
    .min(1, "Bot token and Chat/Channel ID are required.")
    .max(256)
    .regex(/^\d+:[A-Za-z0-9_-]+$/, "Enter a valid Telegram bot token."),
  chatId: z
    .string()
    .trim()
    .min(1, "Bot token and Chat/Channel ID are required.")
    .max(128)
    .regex(/^(-?\d+|@[A-Za-z0-9_]{5,})$/, "Enter a numeric chat id or an @channelname."),
  workspaceId: z.string().uuid().nullish(),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsedBody = await parseJsonBody(request, TelegramConnectBody, {
    message: "Bot token and Chat/Channel ID are required.",
  });
  if (!parsedBody.success) return parsedBody.response;
  const { botToken, chatId, workspaceId } = parsedBody.data;

  if (workspaceId) {
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("*")
      .eq("user_id", user.id)
      .eq("workspace_id", workspaceId)
      .single();

    if (!membership || !canManageSocialAccounts(membership.role as WorkspaceRole)) {
      return NextResponse.json({ error: "Only the workspace Owner or a Manager can connect social accounts." }, { status: 403 });
    }
  }

  try {
    const botInfo = await fetchTelegramBotInfo(botToken);
    const chatInfo = await fetchTelegramChatInfo(botToken, chatId);

    const accountName = chatInfo.title 
      ? `${chatInfo.title} (via @${botInfo.username})` 
      : `@${chatInfo.username || chatId} (via @${botInfo.username})`;

    await upsertSocialAccount(supabase, {
      user_id: user.id,
      workspace_id: workspaceId || null,
      connected_by: user.id,
      platform: TELEGRAM_PLATFORM,
      account_id: String(chatInfo.id) || chatId,
      account_name: accountName,
      account_avatar_url: null,
      access_token: botToken, // Bot token acts as the access token
      refresh_token: null,
      token_expires_at: null,
      scopes: [],
      status: "connected",
      metadata: {
        botToken,
        chatId,
        botUsername: botInfo.username,
        botName: botInfo.name,
        chatTitle: chatInfo.title,
        chatType: chatInfo.type,
        chatUsername: chatInfo.username
      },
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    return NextResponse.json({ ok: true, name: accountName });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Telegram connection failed." },
      { status: 400 }
    );
  }
}
