// lib/integrations/telegram.ts
// Telegram publishing via Bot API (user provides Bot Token + Chat ID — no OAuth needed)

export const TELEGRAM_PLATFORM = "telegram";

const TELEGRAM_API = "https://api.telegram.org";

/**
 * Verifies bot token and returns bot info.
 */
export async function fetchTelegramBotInfo(botToken: string) {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken}/getMe`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || "Invalid Telegram bot token.");
  return {
    id:       data.result.id       as number,
    username: data.result.username as string,
    name:     data.result.first_name as string,
  };
}

/**
 * Fetches info about a Telegram chat/channel/group by chat ID.
 * Chat ID for channels is typically a negative number or @username.
 */
export async function fetchTelegramChatInfo(botToken: string, chatId: string) {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken}/getChat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || "Could not find that Telegram channel. Make sure the bot is added as an admin to your channel.");

  const chatType = data.result.type as string;
  if (chatType !== "channel") {
    throw new Error("Only Telegram Channels are supported. Please connect a Telegram Channel handle (e.g., @mychannel) or Channel ID.");
  }

  return {
    id: data.result.id as number,
    title: data.result.title as string | undefined,
    type: chatType,
    username: data.result.username as string | undefined,
  };
}

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

const DEFAULT_API_ID = Number(process.env.TELEGRAM_API_ID || 2040);
const DEFAULT_API_HASH = process.env.TELEGRAM_API_HASH || "b18441a1ed607e10a39fb21744570f96";

/**
 * Publishes text, single photo/video, or multi-media album to Telegram via MTProto User Session or Bot API.
 * Character limit: 4096 for text posts, 1024 for photo/video captions.
 */
export async function publishToTelegram(
  accessToken: string,
  chatId: string,
  text: string,
  mediaUrl?: string | null,
  mediaUrls?: string[],
  metadata?: Record<string, unknown>
): Promise<string> {
  const isMTProto = metadata?.login_type === "mtproto" || accessToken.length > 100;

  if (isMTProto) {
    const apiId = Number(metadata?.apiId || DEFAULT_API_ID);
    const apiHash = String(metadata?.apiHash || DEFAULT_API_HASH);
    const target = (metadata?.targetChatId as string) || chatId;

    const client = new TelegramClient(new StringSession(accessToken), apiId, apiHash, {
      connectionRetries: 5,
    });
    await client.connect();

    const validUrls = (mediaUrls && mediaUrls.length > 0 ? mediaUrls : [mediaUrl]).filter(Boolean) as string[];

    let resultMsg;
    if (validUrls.length > 0) {
      resultMsg = await client.sendFile(target, {
        file: validUrls.length === 1 ? validUrls[0] : validUrls,
        caption: text.slice(0, 1024),
      });
    } else {
      resultMsg = await client.sendMessage(target, {
        message: text.slice(0, 4096),
      });
    }

    await client.disconnect();
    return String(resultMsg.id);
  }

  // ──── Bot API Fallback ────
  const botToken = accessToken;
  const validUrls = (mediaUrls && mediaUrls.length > 0 ? mediaUrls : [mediaUrl]).filter(Boolean) as string[];

  // 1. Multiple Media Album (up to 10 photos/videos)
  if (validUrls.length > 1) {
    const mediaGroup = validUrls.slice(0, 10).map((url, index) => {
      const isVid = /\.(mp4|mov|webm|avi)(\?|$)/i.test(url);
      return {
        type: isVid ? "video" : "photo",
        media: url,
        caption: index === 0 ? text.slice(0, 1024) || undefined : undefined,
      };
    });

    const res = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMediaGroup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, media: mediaGroup }),
    });

    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.description || `Telegram media group publish failed (${res.status})`);
    }
    return String(data.result?.[0]?.message_id || "published");
  }

  // 2. Single Media or Pure Text
  const singleUrl = validUrls[0] || mediaUrl;
  let res: Response;
  const isVideo = Boolean(singleUrl && /\.(mp4|mov|webm|avi)(\?|$)/i.test(singleUrl));

  if (singleUrl && isVideo) {
    res = await fetch(`${TELEGRAM_API}/bot${botToken}/sendVideo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, video: singleUrl, caption: text.slice(0, 1024) || undefined }),
    });
  } else if (singleUrl) {
    res = await fetch(`${TELEGRAM_API}/bot${botToken}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: singleUrl,
        caption: text.slice(0, 1024) || undefined,
      }),
    });
  } else {
    res = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4096) || "(no text)",
      }),
    });
  }

  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.description || `Telegram publish failed (${res.status})`);
  }
  return String(data.result.message_id);
}
