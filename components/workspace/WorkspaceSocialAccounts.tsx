"use client";

import { useEffect, useState } from "react";
import { Link2, Unlink, Loader2, ShieldCheck } from "lucide-react";
import { canManageSocialAccounts } from "@/lib/workspace/permissions";
import type { WorkspaceRole } from "@/types";

interface WorkspaceAccount {
  id: string;
  platform: string;
  account_id: string;
  account_name: string;
  account_avatar_url: string | null;
  status: string;
  connected_by_name: string;
  connected_at: string | null;
}

const CONNECTABLE = [
  { platform: "instagram", label: "Instagram", connectUrl: "/api/integrations/instagram/connect" },
  { platform: "facebook",  label: "Facebook",  connectUrl: "/api/integrations/meta/connect?platform=facebook" },
  { platform: "threads",   label: "Threads",   connectUrl: "/api/integrations/threads/connect" },
  { platform: "linkedin",  label: "LinkedIn",  connectUrl: "/api/integrations/linkedin/connect" },
  { platform: "youtube",   label: "YouTube",   connectUrl: "/api/integrations/youtube/connect" },
  { platform: "bluesky",   label: "Bluesky",   connectUrl: null }, // handled via modal below (app password, no redirect)
  { platform: "discord",   label: "Discord",   connectUrl: "/api/integrations/discord/connect" },
  { platform: "telegram",  label: "Telegram",  connectUrl: null },
];

export default function WorkspaceSocialAccounts({
  workspaceId,
  currentRole,
}: {
  workspaceId: string;
  currentRole: WorkspaceRole;
}) {
  const [accounts, setAccounts] = useState<WorkspaceAccount[]>([]);
  // `loading` is derived rather than stored: the initial fetch is "loading"
  // until the workspace it belongs to has been recorded, and manual refreshes
  // flip `reloading` from their own event handler. This keeps the mount effect
  // free of synchronous setState.
  const [loadedWorkspaceId, setLoadedWorkspaceId] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const loading = reloading || loadedWorkspaceId !== workspaceId;
  const [error, setError]       = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [blueskyModal, setBlueskyModal] = useState(false);
  const [handle, setHandle] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [connectingBluesky, setConnectingBluesky] = useState(false);

  const [discordModal, setDiscordModal] = useState(false);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");
  const [connectingDiscord, setConnectingDiscord] = useState(false);

  const [telegramModal, setTelegramModal] = useState(false);
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [connectingTelegram, setConnectingTelegram] = useState(false);

  const canManage = canManageSocialAccounts(currentRole);

  // Fetch only — deliberately does not raise a loading flag synchronously, so
  // it is safe to call straight from the mount effect.
  const fetchAccounts = async () => {
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/social-accounts`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAccounts(data.accounts || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load connected accounts.");
    } finally {
      setLoadedWorkspaceId(workspaceId);
      setReloading(false);
    }
  };

  // Refresh triggered by a user action — shows the spinner straight away.
  const load = async () => {
    setReloading(true);
    await fetchAccounts();
  };

  useEffect(() => { void (async () => { await fetchAccounts(); })(); }, [workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const disconnect = async (platform: string, accountId: string) => {
    if (!confirm("Disconnect this account? Scheduled posts using it may fail until reconnected.")) return;
    setDisconnecting(accountId);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/social-accounts?platform=${platform}&accountId=${accountId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      setAccounts((prev) => prev.filter((a) => a.account_id !== accountId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disconnect.");
    } finally {
      setDisconnecting(null);
    }
  };

  const connectBluesky = async () => {
    setConnectingBluesky(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/bluesky/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, appPassword, workspaceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBlueskyModal(false);
      setHandle("");
      setAppPassword("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect Bluesky.");
    } finally {
      setConnectingBluesky(false);
    }
  };

  const connectDiscord = async () => {
    setConnectingDiscord(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/discord/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: discordWebhookUrl, workspaceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDiscordModal(false);
      setDiscordWebhookUrl("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect Discord.");
    } finally {
      setConnectingDiscord(false);
    }
  };

  const connectTelegram = async () => {
    setConnectingTelegram(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/telegram/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: telegramBotToken, chatId: telegramChatId, workspaceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTelegramModal(false);
      setTelegramBotToken("");
      setTelegramChatId("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect Telegram.");
    } finally {
      setConnectingTelegram(false);
    }
  };

  const connectedPlatforms = new Set(accounts.map((a) => a.platform));

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-700 flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          These accounts belong to <strong>{`the workspace`}</strong>, not to any one member. Every post — whether
          published now, scheduled, or sent by automation — always goes out through these accounts, no matter who
          created, approved, or scheduled it.
        </p>
      </div>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-gray-100 bg-white p-8 text-xs font-bold text-slate-400 min-h-[120px]">
          <Loader2 className="h-4 w-4 animate-spin text-[#2f7867]" /> Loading connected accounts...
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.length === 0 && (
            <p className="text-sm text-gray-400">No workspace accounts connected yet.</p>
          )}
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3">
              <div className="flex items-center gap-3">
                {a.account_avatar_url ? (
                  <img src={a.account_avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-gray-100 grid place-items-center text-xs font-bold text-gray-400 capitalize">
                    {a.platform[0]}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-gray-900">{a.account_name}</p>
                  <p className="text-xs text-gray-400 capitalize">{a.platform} · connected by {a.connected_by_name}</p>
                </div>
              </div>
              {canManage && (
                <button
                  onClick={() => disconnect(a.platform, a.account_id)}
                  disabled={disconnecting === a.account_id}
                  className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg px-3 py-1.5 disabled:opacity-40"
                >
                  {disconnecting === a.account_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                  Disconnect
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Connect another account</h3>
          <div className="flex flex-wrap gap-2">
            {CONNECTABLE.filter((c) => !connectedPlatforms.has(c.platform)).map((c) => (
              <a
                key={c.platform}
                href={c.connectUrl ? `${c.connectUrl}${c.connectUrl.includes("?") ? "&" : "?"}workspaceId=${workspaceId}` : undefined}
                onClick={c.connectUrl ? undefined : (e) => {
                  e.preventDefault();
                  if (c.platform === "telegram") setTelegramModal(true);
                  else setBlueskyModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <Link2 className="h-3.5 w-3.5" /> {c.label}
              </a>
            ))}
          </div>
        </div>
      )}

      {blueskyModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => setBlueskyModal(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Connect Bluesky for the workspace</h3>
            <div className="space-y-3">
              <input
                type="text" placeholder="handle.bsky.social"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={handle} onChange={(e) => setHandle(e.target.value)}
              />
              <input
                type="password" placeholder="App password"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={appPassword} onChange={(e) => setAppPassword(e.target.value)}
              />
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setBlueskyModal(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button
                onClick={connectBluesky}
                disabled={connectingBluesky || !handle || !appPassword}
                className="flex-1 px-4 py-2 bg-black text-white rounded-xl text-sm font-medium disabled:opacity-40"
              >
                {connectingBluesky ? "Connecting..." : "Connect"}
              </button>
            </div>
          </div>
        </div>
      )}

      {discordModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => setDiscordModal(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Connect Discord for the workspace</h3>
            <p className="text-xs text-gray-500 mb-3">Go to your Discord channel → Settings → Integrations → Webhooks → Copy URL.</p>
            <div className="space-y-3">
              <input
                type="text" placeholder="https://discord.com/api/webhooks/..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={discordWebhookUrl} onChange={(e) => setDiscordWebhookUrl(e.target.value)}
              />
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setDiscordModal(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button
                onClick={connectDiscord}
                disabled={connectingDiscord || !discordWebhookUrl}
                className="flex-1 px-4 py-2 bg-[#5865F2] text-white rounded-xl text-sm font-medium disabled:opacity-40"
              >
                {connectingDiscord ? "Connecting..." : "Connect"}
              </button>
            </div>
          </div>
        </div>
      )}

      {telegramModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => setTelegramModal(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Connect Telegram for the workspace</h3>
            <p className="text-xs text-gray-500 mb-3">Create a bot via @BotFather, then add it as an admin to your channel/group.</p>
            <div className="space-y-3">
              <input
                type="password" placeholder="Bot Token (123456789:ABCdef...)"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={telegramBotToken} onChange={(e) => setTelegramBotToken(e.target.value)}
              />
              <input
                type="text" placeholder="Chat/Channel ID (-100xxx or @channel)"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)}
              />
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setTelegramModal(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button
                onClick={connectTelegram}
                disabled={connectingTelegram || !telegramBotToken || !telegramChatId}
                className="flex-1 px-4 py-2 bg-[#26A5E4] text-white rounded-xl text-sm font-medium disabled:opacity-40"
              >
                {connectingTelegram ? "Connecting..." : "Connect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
