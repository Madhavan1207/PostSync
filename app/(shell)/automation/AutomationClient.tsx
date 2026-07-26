"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Sparkles,
  Play,
  Check,
  X,
  Edit2,
  Trash2,
  Clock,
  Sliders,
  History,
  Plus,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Save,
  Info,
  Calendar,
  Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface User {
  id: string;
  email?: string | null;
}

export type AutomationScheduleType = "daily" | "weekly" | "weekdays" | "monthly";

export interface AutomationSettings {
  is_enabled: boolean;
  post_time: string;
  mode: "manual" | "automatic";
  platforms: string[];
  categories: string[];
  keywords: string[];
  approval_email?: string | null;
  schedule_type?: AutomationScheduleType;
  post_times?: string[];
  post_days?: string[];
  post_day_of_month?: number;
  frontend_url?: string;
  use_same_settings?: boolean;
  time_configs?: Record<string, { platforms: string[], categories: string[], keywords: string[] }>;
}

export interface AutomationLog {
  id: string;
  trend_title: string;
  caption: string;
  media_url: string;
  mode: "manual" | "automatic";
  status: "pending" | "approved" | "rejected" | "published" | "failed";
  scheduled_post_id?: string | null;
  created_at: string;
  scheduled_posts?: {
    platforms: string[];
  } | null;
}

interface Props {
  user: User;
  initialSettings: AutomationSettings;
  initialLogs: AutomationLog[];
}

// Caught values are `unknown`; pull a usable message out without asserting.
function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

const AVAILABLE_PLATFORMS = [
  { id: "threads", name: "Threads" },
  { id: "instagram", name: "Instagram" },
  { id: "facebook", name: "Facebook" },
  { id: "linkedin", name: "LinkedIn" },
  { id: "bluesky", name: "Bluesky" },
  { id: "discord", name: "Discord" },
  { id: "telegram", name: "Telegram" },
];

const AVAILABLE_CATEGORIES = [
  { id: "world", name: "World Feed" },
  { id: "technology", name: "Technology" },
  { id: "business", name: "Business & Markets" },
  { id: "sports", name: "Sports" },
  { id: "entertainment", name: "Entertainment" },
  { id: "science", name: "Science" },
  { id: "health", name: "Health" }
];

export default function AutomationClient({ user, initialSettings, initialLogs }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Convert UTC post_times from DB to local times for inputs
  const getInitialLocalTimes = () => {
    const rawTimes = initialSettings.post_times || (initialSettings.post_time ? [initialSettings.post_time] : ["09:00:00"]);
    return rawTimes.map((timeStr: string) => {
      const [h, m] = timeStr.split(":").map(Number);
      const d = new Date();
      d.setUTCHours(h, m, 0, 0);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    });
  };

  // Settings states
  const [isEnabled, setIsEnabled] = useState(Boolean(initialSettings.is_enabled === true));
  const [postTimes, setPostTimes] = useState<string[]>(getInitialLocalTimes());
  const [scheduleType, setScheduleType] = useState<AutomationScheduleType>(
    initialSettings.schedule_type || "daily"
  );
  const [postDays, setPostDays] = useState<string[]>(
    initialSettings.post_days || ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
  );
  const [postDayOfMonth, setPostDayOfMonth] = useState<number>(initialSettings.post_day_of_month || 1);

  const [mode, setMode] = useState<"manual" | "automatic">(initialSettings.mode || "manual");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(initialSettings.platforms || []);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialSettings.categories || ["world"]);
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>(initialSettings.keywords || []);
  const [approvalEmail, setApprovalEmail] = useState(initialSettings.approval_email || user.email || "");

  // Multi-time config states
  const [useSameSettings, setUseSameSettings] = useState<boolean>(initialSettings.use_same_settings !== false);
  const [timeConfigs, setTimeConfigs] = useState<Record<string, { platforms: string[], categories: string[], keywords: string[] }>>(initialSettings.time_configs || {});
  const [selectedTimeForConfig, setSelectedTimeForConfig] = useState<string>("all");
  const [activePickerIdx, setActivePickerIdx] = useState<number | null>(null);

  // Logs states
  const [logs, setLogs] = useState<AutomationLog[]>(initialLogs);

  // Editing states for pending cards
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState("");

  // Loading states
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [processingLogId, setProcessingLogId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // The approval emails redirect back here with ?status=&message=. Derive that
  // toast as the initial state instead of setting it from an effect, which
  // would kick off an extra render pass on every arrival.
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(() => {
    const status = searchParams.get("status");
    const msg = searchParams.get("message");
    if (!status || !msg) return null;
    return { msg, type: status === "success" ? "success" : "error" };
  });

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
  };

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Strip the one-shot notification params off the URL once they've been read.
  useEffect(() => {
    const status = searchParams.get("status");
    const msg = searchParams.get("message");
    if (status && msg) {
      const url = new URL(window.location.href);
      url.searchParams.delete("status");
      url.searchParams.delete("message");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [searchParams]);

  // Convert local selectedTimeForConfig ("17:15") to UTC key ("11:45:00")
  const localTimeToUtcStr = (localTime: string): string => {
    if (!localTime || localTime === "all") return "";
    const [h, m] = localTime.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:00`;
  };

  const formatLocalTimeDisplay = (timeStr: string) => {
    if (!timeStr || timeStr === "all") return "";
    const [h, m] = timeStr.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const displayHour = h % 12 || 12;
    return `${String(displayHour).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  // Keyboard keywords input helper
  const handleAddKeyword = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = keywordInput.trim().toLowerCase();
      if (!val) return;

      if (useSameSettings || selectedTimeForConfig === "all") {
        if (!keywords.includes(val)) {
          setKeywords([...keywords, val]);
          setKeywordInput("");
        }
      } else {
        const utcKey = localTimeToUtcStr(selectedTimeForConfig);
        const currentConf = timeConfigs[utcKey] || { platforms: selectedPlatforms, categories: selectedCategories, keywords: keywords };
        const kws = currentConf.keywords || [];
        if (!kws.includes(val)) {
          setTimeConfigs({
            ...timeConfigs,
            [utcKey]: { ...currentConf, keywords: [...kws, val] }
          });
          setKeywordInput("");
        }
      }
    }
  };

  const handleRemoveKeyword = (kw: string) => {
    if (useSameSettings || selectedTimeForConfig === "all") {
      setKeywords(keywords.filter((k) => k !== kw));
    } else {
      const utcKey = localTimeToUtcStr(selectedTimeForConfig);
      const currentConf = timeConfigs[utcKey] || { platforms: selectedPlatforms, categories: selectedCategories, keywords: keywords };
      const kws = currentConf.keywords || [];
      setTimeConfigs({
        ...timeConfigs,
        [utcKey]: { ...currentConf, keywords: kws.filter((k) => k !== kw) }
      });
    }
  };

  // Toggle platform select
  const togglePlatform = (id: string) => {
    if (useSameSettings || selectedTimeForConfig === "all") {
      if (selectedPlatforms.includes(id)) {
        setSelectedPlatforms(selectedPlatforms.filter((p) => p !== id));
      } else {
        setSelectedPlatforms([...selectedPlatforms, id]);
      }
    } else {
      const utcKey = localTimeToUtcStr(selectedTimeForConfig);
      const currentConf = timeConfigs[utcKey] || { platforms: selectedPlatforms, categories: selectedCategories, keywords: keywords };
      const platforms = currentConf.platforms || [];
      const nextPlatforms = platforms.includes(id) ? platforms.filter((p) => p !== id) : [...platforms, id];
      setTimeConfigs({
        ...timeConfigs,
        [utcKey]: { ...currentConf, platforms: nextPlatforms }
      });
    }
  };

  // Toggle category select
  const toggleCategory = (id: string) => {
    if (useSameSettings || selectedTimeForConfig === "all") {
      if (selectedCategories.includes(id)) {
        setSelectedCategories(selectedCategories.filter((c) => c !== id));
      } else {
        setSelectedCategories([...selectedCategories, id]);
      }
    } else {
      const utcKey = localTimeToUtcStr(selectedTimeForConfig);
      const currentConf = timeConfigs[utcKey] || { platforms: selectedPlatforms, categories: selectedCategories, keywords: keywords };
      const categories = currentConf.categories || [];
      const nextCategories = categories.includes(id) ? categories.filter((c) => c !== id) : [...categories, id];
      setTimeConfigs({
        ...timeConfigs,
        [utcKey]: { ...currentConf, categories: nextCategories }
      });
    }
  };

  const getUtcPostTimes = (localTimes: string[]) => {
    return localTimes.map((localTime) => {
      const [h, m] = localTime.split(":").map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:00`;
    });
  };

  // Toggle Content Automation Active/Paused
  const handleToggleAutomation = async () => {
    const nextState = !isEnabled;
    setIsEnabled(nextState);
    try {
      const res = await fetch("/api/automation/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_enabled: nextState,
          post_times: getUtcPostTimes(postTimes),
          schedule_type: scheduleType,
          post_days: postDays,
          post_day_of_month: postDayOfMonth,
          mode,
          platforms: selectedPlatforms,
          categories: selectedCategories,
          keywords,
          approval_email: approvalEmail,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          frontend_url: window.location.origin,
          use_same_settings: useSameSettings,
          time_configs: timeConfigs,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");
      showToast(nextState ? "Content Automation Enabled." : "Content Automation Paused.");
    } catch {
      showToast("Failed to update status", "error");
      setIsEnabled(!nextState); // rollback
    }
  };

  // Save Settings to Database
  const handleSaveSettings = async () => {
    setSaving(true);
    setActionError(null);
    try {
      const res = await fetch("/api/automation/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_enabled: isEnabled,
          post_times: getUtcPostTimes(postTimes),
          schedule_type: scheduleType,
          post_days: postDays,
          post_day_of_month: postDayOfMonth,
          mode,
          platforms: selectedPlatforms,
          categories: selectedCategories,
          keywords,
          approval_email: approvalEmail,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          frontend_url: window.location.origin,
          use_same_settings: useSameSettings,
          time_configs: timeConfigs,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");

      showToast("Automation configurations saved.");
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, "Failed to save configurations"));
      showToast("Failed to save configurations", "error");
    } finally {
      setSaving(false);
    }
  };

  // Manually trigger the automation generator run (simulation)
  const handleTestTrigger = async () => {
    setTriggering(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/automation/trigger?test=true&user_id=${user.id}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ""}`, // Fallback structure
        }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to trigger automation");

      // Refresh logs list
      const logsRes = await fetch("/api/automation/logs");
      const logsData = await logsRes.json();
      if (logsRes.ok) {
        setLogs(logsData.logs || []);
      }

      showToast(
        data.mode === "automatic"
          ? "Automation triggered: Post generated and published!"
          : "Automation triggered: New draft pending review!"
      );
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, "Failed to run automation trigger"));
      showToast("Trigger failed", "error");
    } finally {
      setTriggering(false);
    }
  };

  // Reject / Discard a pending post
  const handleRejectLog = async (logId: string) => {
    setProcessingLogId(logId);
    try {
      const res = await fetch("/api/automation/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId, action: "reject" }),
      });
      if (!res.ok) throw new Error("Failed to reject log item");

      setLogs((prev) =>
        prev.map((l) => (l.id === logId ? { ...l, status: "rejected" as const } : l))
      );
      showToast("Draft rejected.");
    } catch {
      showToast("Action failed", "error");
    } finally {
      setProcessingLogId(null);
    }
  };

  // Save caption edits inline
  const handleSaveEdit = async (logId: string) => {
    try {
      const res = await fetch("/api/automation/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId, action: "edit", caption: editingCaption }),
      });
      if (!res.ok) throw new Error("Failed to save edits");

      setLogs((prev) =>
        prev.map((l) => (l.id === logId ? { ...l, caption: editingCaption } : l))
      );
      setEditingLogId(null);
      showToast("Caption updated.");
    } catch {
      showToast("Failed to save caption edits", "error");
    }
  };

  // Publish a pending post immediately
  const handlePublishNow = async (log: AutomationLog) => {
    setProcessingLogId(log.id);
    try {
      // 1. Trigger actual social publish
      const formData = new FormData();
      formData.append("caption", log.caption);
      formData.append("mediaUrl", log.media_url);
      formData.append("mediaType", "image");
      formData.append("platforms", selectedPlatforms.join(","));

      const pubRes = await fetch("/api/posts/publish", {
        method: "POST",
        body: formData,
      });
      const pubData = await pubRes.json();

      if (!pubRes.ok || !pubData.ok) {
        throw new Error(pubData.error || "Publishing failed");
      }

      // 2. Mark log as published
      const res = await fetch("/api/automation/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: log.id, action: "approve", status: "published" }),
      });
      if (!res.ok) throw new Error("Log status update failed");

      setLogs((prev) =>
        prev.map((l) => (l.id === log.id ? { ...l, status: "published" as const } : l))
      );
      showToast("Post published successfully!");
    } catch (err: unknown) {
      showToast(getErrorMessage(err, "Failed to publish"), "error");
    } finally {
      setProcessingLogId(null);
    }
  };

  // Schedule a pending post
  const handleSchedulePost = async (log: AutomationLog) => {
    setProcessingLogId(log.id);
    try {
      // Schedule for the next configured time block or current time + 1 hour
      const schedTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      // 1. Insert into scheduled_posts
      const schedRes = await fetch("/api/scheduled-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: log.trend_title,
          description: log.caption,
          media_urls: log.media_url ? [log.media_url] : [],
          platforms: selectedPlatforms,
          scheduled_time: schedTime,
        }),
      });
      const schedData = await schedRes.json();
      if (!schedRes.ok) throw new Error(schedData.error || "Scheduling failed");

      // 2. Mark log as approved and bind the scheduled post id
      const res = await fetch("/api/automation/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logId: log.id,
          action: "approve",
          status: "approved",
          scheduledPostId: schedData.post.id,
        }),
      });
      if (!res.ok) throw new Error("Log status update failed");

      setLogs((prev) =>
        prev.map((l) => (l.id === log.id ? { ...l, status: "approved" as const, scheduled_post_id: schedData.post.id } : l))
      );
      showToast("Post approved and scheduled.");
    } catch (err: unknown) {
      showToast(getErrorMessage(err, "Failed to schedule"), "error");
    } finally {
      setProcessingLogId(null);
    }
  };

  const pendingQueue = logs.filter((l) => l.status === "pending");
  const pastLogs = logs;

  const get24hTime = (h12: number, min: number, period: string): string => {
    let h24 = h12;
    if (period === "PM" && h12 < 12) h24 += 12;
    if (period === "AM" && h12 === 12) h24 = 0;
    return `${String(h24).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
  };

  // Active configurations based on selectedTimeForConfig
  const utcKey = localTimeToUtcStr(selectedTimeForConfig);
  const activePlatforms = useSameSettings || selectedTimeForConfig === "all"
    ? selectedPlatforms
    : (timeConfigs[utcKey]?.platforms || selectedPlatforms);

  const activeCategories = useSameSettings || selectedTimeForConfig === "all"
    ? selectedCategories
    : (timeConfigs[utcKey]?.categories || selectedCategories);

  const activeKeywords = useSameSettings || selectedTimeForConfig === "all"
    ? keywords
    : (timeConfigs[utcKey]?.keywords || keywords);

  return (
    <div className="dashboard-light relative min-h-screen bg-[#f6f7f1] text-[#1f2528]">
      {/* Background Gradients */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(43,114,100,0.08),transparent_34%),linear-gradient(315deg,rgba(208,89,69,0.07),transparent_30%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(31,37,40,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(31,37,40,0.045)_1px,transparent_1px)] bg-[size:72px_72px] opacity-50" />
      </div>

      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-bold shadow-xl border backdrop-blur-md transition-all duration-300 ${
            toast.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-600"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {toast.msg}
        </div>
      )}

      <div className="relative mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1f2528]/8 pb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#2f7867]/70">Scheduler Engine</p>
            <h1 className="mt-1 text-3xl font-black tracking-[-0.03em] text-[#1f2528]">Content Automation</h1>
            <p className="mt-1 text-sm text-slate-500">
              Auto-generate drafts and publish them directly to your socials.
            </p>
          </div>

          {/* Big ON/OFF Toggle Button */}
          <div className="flex items-center justify-between sm:justify-start gap-3 bg-white border border-[#1f2528]/8 px-4 py-2.5 rounded-2xl shadow-sm w-full sm:w-auto">
            <span className={`text-[10px] font-extrabold uppercase tracking-widest ${isEnabled ? 'text-[#2f7867]' : 'text-slate-400'}`}>
              {isEnabled ? 'Automation Active' : 'Automation Paused'}
            </span>
            <button
              onClick={handleToggleAutomation}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${
                isEnabled ? 'bg-[#2f7867]' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${
                  isEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {actionError && (
          <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-600">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {actionError}
          </div>
        )}

        <div className="relative">
          {/* Overlay Lock Banner when Content Automation is OFF */}
          {!isEnabled && (
            <div className="absolute inset-0 z-30 flex items-start justify-center pt-16 bg-slate-50/40 backdrop-blur-[1.5px] rounded-3xl transition-all duration-300">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white/95 px-6 py-4 shadow-2xl backdrop-blur-md max-w-md text-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 shrink-0">
                  <Lock className="h-5 w-5" />
                </span>
                <div className="text-left">
                  <p className="text-xs font-black text-[#1f2528] uppercase tracking-wide">Automation Paused</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Content Automation settings & history are visible but non-accessible. Toggle <strong className="text-[#2f7867]">&quot;AUTOMATION ACTIVE&quot;</strong> above to enable and configure.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className={`grid gap-8 lg:grid-cols-12 transition-all duration-300 ${!isEnabled ? "opacity-50 pointer-events-none select-none filter grayscale-[15%]" : ""}`}>
          {/* LEFT SIDEBAR: Automation Settings */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-2xl border border-[#1f2528]/10 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#1f2528]/8 pb-4">
                <div className="flex items-center gap-2.5">
                  <Sliders className="h-5 w-5 text-[#2f7867]" />
                  <h2 className="font-black text-sm text-[#1f2528] tracking-tight">Automation Settings</h2>
                </div>
              </div>

              <div className="mt-6 space-y-6">
                {/* Automation Mode */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Publishing Mode</label>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => setMode("manual")}
                      className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all duration-200 ${
                        mode === "manual"
                          ? "border-[#2f7867] bg-[#2f7867]/5 ring-1 ring-[#2f7867]"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-xs font-bold text-[#1f2528]">Manual Approval</span>
                      <span className="mt-1 text-[10px] leading-relaxed text-slate-400">
                        Generated 10 minutes before posting time. Sent to your email for approval.
                      </span>
                    </button>
                    <button
                      onClick={() => setMode("automatic")}
                      className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all duration-200 ${
                        mode === "automatic"
                          ? "border-[#2f7867] bg-[#2f7867]/5 ring-1 ring-[#2f7867]"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-xs font-bold text-[#1f2528]">Fully Automatic</span>
                      <span className="mt-1 text-[10px] leading-relaxed text-slate-400">
                        Generated 10 minutes before posting time and added to scheduled calendar.
                      </span>
                    </button>
                  </div>
                </div>

                {/* Approval Email */}
                {mode === "manual" && (
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Approval Notification Email</label>
                    <input
                      type="email"
                      value={approvalEmail}
                      onChange={(e) => setApprovalEmail(e.target.value)}
                      placeholder="e.g. yourname@domain.com"
                      className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-[#1f2528] shadow-sm focus:border-[#2f7867] focus:outline-none"
                    />
                    <p className="mt-1 text-[10px] text-slate-400 leading-relaxed">
                      Approval drafts and links will be sent to this email address exactly 10 minutes before posting.
                    </p>
                  </div>
                )}

                {/* Advanced Recurrence Pattern */}
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <Calendar className="h-3.5 w-3.5" /> Recurrence Pattern
                  </label>
                  <select
                    value={scheduleType}
                    onChange={(e) => setScheduleType(e.target.value as AutomationScheduleType)}
                    className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-[#1f2528] shadow-sm focus:border-[#2f7867] focus:outline-none"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekdays">Every weekday (Monday to Friday)</option>
                    <option value="weekly">Weekly (Custom days)</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                {/* Weekly Day Toggles */}
                {scheduleType === "weekly" && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Active Days
                    </label>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => {
                        const selected = postDays.includes(day);
                        const label = day.slice(0, 3).toUpperCase();
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              if (postDays.includes(day)) {
                                setPostDays(postDays.filter((d) => d !== day));
                              } else {
                                setPostDays([...postDays, day]);
                              }
                            }}
                            className={`h-8 w-12 rounded-lg border text-[10px] font-black transition flex items-center justify-center ${
                              selected
                                ? "border-[#2f7867] bg-[#2f7867] text-white"
                                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Monthly Day Selector */}
                {scheduleType === "monthly" && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Day of the Month
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={postDayOfMonth}
                      onChange={(e) => setPostDayOfMonth(Math.max(1, Math.min(31, Number(e.target.value))))}
                      className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-[#1f2528] shadow-sm focus:border-[#2f7867] focus:outline-none"
                    />
                  </div>
                )}

                {/* Multiple Posting Times */}
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <Clock className="h-3.5 w-3.5" /> Posting Times
                  </label>
                  <div className="space-y-2">
                    {postTimes.map((time, idx) => {
                      const [h24Str, mStr] = time.split(":");
                      const h24 = Number(h24Str || 9);
                      const mDisplay = mStr || "00";
                      const ampm = h24 >= 12 ? "PM" : "AM";
                      const h12 = h24 % 12 || 12;
                      const h12Str = String(h12).padStart(2, "0");

                      return (
                        <div key={idx} className="relative flex items-center gap-2">
                          {/* Sleek Custom Trigger Button */}
                          <button
                            type="button"
                            onClick={() => setActivePickerIdx(activePickerIdx === idx ? null : idx)}
                            className="flex items-center justify-between w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-[#1f2528] shadow-sm hover:border-indigo-300 transition text-left focus:outline-none"
                          >
                            <span>{h12Str}:{mDisplay} {ampm}</span>
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                          </button>

                          {/* Custom Time Selector Dropdown Overlay */}
                          {activePickerIdx === idx && (
                            <>
                              {/* Click-outside backdrop wrapper */}
                              <div className="fixed inset-0 z-30" onClick={() => setActivePickerIdx(null)} />
                              
                              <div className="absolute top-[42px] left-0 z-40 bg-white border border-slate-200/80 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.06)] p-3 flex gap-3 h-48 w-56 backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-150">
                                
                                {/* Hours Select Column */}
                                <div className="flex-1 overflow-y-auto scrollbar-none h-full space-y-0.5 pr-1 border-r border-slate-100">
                                  {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => {
                                    const isActive = h === h12;
                                    return (
                                      <button
                                        key={h}
                                        type="button"
                                        onClick={() => {
                                          const nextTime = get24hTime(h, Number(mDisplay), ampm);
                                          const newTimes = [...postTimes];
                                          newTimes[idx] = nextTime;
                                          setPostTimes(newTimes);
                                        }}
                                        className={`w-full py-1.5 rounded-lg text-center font-bold text-[11px] transition ${
                                          isActive ? "bg-indigo-600 text-white" : "hover:bg-slate-50 text-slate-600"
                                        }`}
                                      >
                                        {String(h).padStart(2, "0")}
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Minutes Select Column */}
                                <div className="flex-1 overflow-y-auto scrollbar-none h-full space-y-0.5 pr-1 border-r border-slate-100">
                                  {Array.from({ length: 60 }, (_, i) => i).map((m) => {
                                    const isActive = m === Number(mDisplay);
                                    return (
                                      <button
                                        key={m}
                                        type="button"
                                        onClick={() => {
                                          const nextTime = get24hTime(h12, m, ampm);
                                          const newTimes = [...postTimes];
                                          newTimes[idx] = nextTime;
                                          setPostTimes(newTimes);
                                        }}
                                        className={`w-full py-1.5 rounded-lg text-center font-bold text-[11px] transition ${
                                          isActive ? "bg-indigo-600 text-white" : "hover:bg-slate-50 text-slate-600"
                                        }`}
                                      >
                                        {String(m).padStart(2, "0")}
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Period Select Column (AM/PM) */}
                                <div className="flex flex-col gap-1.5 justify-center pl-1">
                                  {["AM", "PM"].map((p) => {
                                    const isActive = p === ampm;
                                    return (
                                      <button
                                        key={p}
                                        type="button"
                                        onClick={() => {
                                          const nextTime = get24hTime(h12, Number(mDisplay), p);
                                          const newTimes = [...postTimes];
                                          newTimes[idx] = nextTime;
                                          setPostTimes(newTimes);
                                        }}
                                        className={`px-2.5 py-2 rounded-lg text-center font-black text-[10px] transition border ${
                                          isActive
                                            ? "bg-indigo-600 border-indigo-700 text-white"
                                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                        }`}
                                      >
                                        {p}
                                      </button>
                                    );
                                  })}
                                </div>

                              </div>
                            </>
                          )}

                          {postTimes.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setPostTimes(postTimes.filter((_, i) => i !== idx))}
                              className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition border border-transparent hover:border-rose-100 shrink-0"
                              title="Remove Time"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPostTimes([...postTimes, "09:00:00"])}
                    className="mt-1 flex items-center gap-1 text-[10px] font-bold text-[#2f7867] hover:text-[#255f52] transition focus:outline-none"
                  >
                    + Add Posting Time
                  </button>
                </div>

                {/* Multi-time Configuration Selector Mode */}
                <div className="bg-[#2f7867]/5 border border-[#2f7867]/10 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-[#1f2528] uppercase tracking-wide">Configure per post time</h4>
                      <p className="text-[9px] text-slate-400 font-bold leading-normal">Use different platforms, categories, or keywords for each scheduled time.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextValue = !useSameSettings;
                        setUseSameSettings(nextValue);
                        if (nextValue) {
                          setSelectedTimeForConfig("all");
                        } else if (postTimes.length > 0) {
                          setSelectedTimeForConfig(postTimes[0]);
                        }
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        !useSameSettings ? "bg-indigo-600" : "bg-slate-200"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          !useSameSettings ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {!useSameSettings && (
                    <div className="flex flex-col gap-2 pt-2.5 border-t border-slate-200/50">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide">Editing settings for time:</label>
                      <div className="flex flex-wrap gap-1.5">
                        {postTimes.map((timeStr) => (
                          <button
                            key={timeStr}
                            type="button"
                            onClick={() => setSelectedTimeForConfig(timeStr)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide transition border ${
                              selectedTimeForConfig === timeStr
                                ? "bg-indigo-600 border-indigo-700 text-white shadow-sm"
                                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            {formatLocalTimeDisplay(timeStr)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Target Channels */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span>Target Channels</span>
                    {!useSameSettings && selectedTimeForConfig !== "all" && (
                      <span className="text-[9px] text-indigo-600 font-black uppercase tracking-wide">
                        [Editing {formatLocalTimeDisplay(selectedTimeForConfig)}]
                      </span>
                    )}
                  </label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {AVAILABLE_PLATFORMS.map((p) => {
                      const selected = activePlatforms.includes(p.id);
                      
                      // Official brand color styles when selected
                      let activeStyle = "border-slate-200 bg-white text-slate-600 hover:bg-slate-50";
                      if (selected) {
                        if (p.id === "threads") {
                          activeStyle = "bg-zinc-950 border-zinc-950 text-white shadow-sm";
                        } else if (p.id === "instagram") {
                          activeStyle = "bg-gradient-to-r from-[#f09433] via-[#e6683c] via-[#dc2743] via-[#cc2366] to-[#bc1888] border-transparent text-white shadow-sm";
                        } else if (p.id === "facebook") {
                          activeStyle = "bg-[#1877f2] border-[#1877f2] text-white shadow-sm";
                        } else if (p.id === "linkedin") {
                          activeStyle = "bg-[#0a66c2] border-[#0a66c2] text-white shadow-sm";
                        } else if (p.id === "bluesky") {
                          activeStyle = "bg-[#0560ff] border-[#0560ff] text-white shadow-sm";
                        } else if (p.id === "discord") {
                          activeStyle = "bg-[#5865f2] border-[#5865f2] text-white shadow-sm";
                        } else if (p.id === "telegram") {
                          activeStyle = "bg-[#26a5e4] border-[#26a5e4] text-white shadow-sm";
                        } else {
                          activeStyle = "bg-indigo-600 border-indigo-700 text-white shadow-sm";
                        }
                      }

                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePlatform(p.id)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${activeStyle}`}
                        >
                          <span className={selected ? "text-white" : ""}>{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Trend Topics Curation */}
                <div className="border-t border-slate-100 pt-5 space-y-4">
                  <h3 className="text-xs font-black text-[#1f2528]">Trends & Curation Filters</h3>

                  {/* Categories */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monitoring Categories</label>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {AVAILABLE_CATEGORIES.map((c) => {
                        const selected = activeCategories.includes(c.id);
                        
                        let catActiveStyle = "border-slate-150 bg-white text-slate-500 hover:bg-slate-50";
                        if (selected) {
                          if (c.id === "world") {
                            catActiveStyle = "border-sky-350 bg-sky-50 text-sky-700 shadow-sm";
                          } else if (c.id === "technology") {
                            catActiveStyle = "border-emerald-355 bg-emerald-50 text-emerald-700 shadow-sm";
                          } else if (c.id === "business") {
                            catActiveStyle = "border-amber-350 bg-amber-50 text-amber-700 shadow-sm";
                          } else if (c.id === "sports") {
                            catActiveStyle = "border-rose-350 bg-rose-50 text-rose-700 shadow-sm";
                          } else if (c.id === "entertainment") {
                            catActiveStyle = "border-purple-350 bg-purple-50 text-purple-700 shadow-sm";
                          } else if (c.id === "science") {
                            catActiveStyle = "border-indigo-350 bg-indigo-50 text-indigo-700 shadow-sm";
                          } else if (c.id === "health") {
                            catActiveStyle = "border-lime-350 bg-lime-50 text-lime-700 shadow-sm";
                          } else {
                            catActiveStyle = "border-indigo-350 bg-indigo-50 text-indigo-700 shadow-sm";
                          }
                        }

                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleCategory(c.id)}
                            className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold transition ${catActiveStyle}`}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Keywords Input */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Keywords</label>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-2">
                      {activeKeywords.map((kw) => (
                        <span
                          key={kw}
                          className="flex items-center gap-1 rounded-md bg-indigo-50/50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-150"
                        >
                          {kw}
                          <button type="button" onClick={() => handleRemoveKeyword(kw)} className="text-indigo-400 hover:text-indigo-600">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        onKeyDown={handleAddKeyword}
                        placeholder={activeKeywords.length === 0 ? "Type keywords and hit Enter..." : "Add keyword..."}
                        className="flex-1 bg-transparent px-1 text-xs outline-none min-w-[80px]"
                      />
                    </div>
                  </div>
                </div>

                {/* Save settings CTA */}
                <div className="border-t border-slate-100 pt-5">
                  <Button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="w-full rounded-xl bg-[#2f7867] text-white shadow hover:bg-[#255f52] transition text-xs font-bold flex items-center justify-center gap-2 py-3"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Configurations
                  </Button>
                </div>
              </div>
            </div>

            {/* Email Preview Card */}
            {mode === "manual" && (
              <div className="rounded-2xl border border-emerald-100 bg-[#eaf3ed]/30 p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#2f7867]" />
                  <h3 className="text-xs font-black text-[#1f2528] tracking-tight">Interactive Email Preview</h3>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Here is a mockup of the interactive approvals email you will receive in your inbox:
                </p>
                <div className="rounded-xl border border-slate-150 bg-white p-4 shadow-sm text-left space-y-3 pointer-events-none scale-[0.98]">
                  <div>
                    <span className="text-[8px] font-black uppercase text-[#2f7867]">Postelligence Automated Draft</span>
                    <h4 className="text-xs font-black text-[#1f2528] mt-0.5">Example: Tech Trends Live</h4>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2 text-[10px] text-slate-500 font-medium italic border border-slate-100">
                    &ldquo;AI agents are taking over corporate administration task schedules...&rdquo;
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    <div className="rounded bg-[#2f7867] px-2.5 py-1 text-[8px] font-black text-white">Approve & Schedule</div>
                    <div className="rounded bg-[#2f7867]/10 px-2.5 py-1 text-[8px] font-black text-[#2f7867] border border-slate-200">Publish Now</div>
                    <div className="rounded bg-white px-2.5 py-1 text-[8px] font-black text-rose-500 border border-rose-200">Reject</div>
                  </div>
                </div>
              </div>
            )}

            {/* Storage Info Alert */}
            <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4 text-xs leading-relaxed text-sky-800 flex gap-3">
              <Info className="h-5 w-5 text-sky-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Automated Visual Search:</span> The scheduler queries public search indexes to fetch high-resolution, factual visuals for trends automatically.
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Execution Logs */}
          <div className="lg:col-span-7 space-y-8">
            {/* Automation Execution Logs History */}
            <div>
              <h2 className="text-base font-black text-[#1f2528] tracking-tight flex items-center gap-2">
                <History className="h-4 w-4 text-slate-400" /> Activity History ({pastLogs.length})
              </h2>

              <div className="mt-4 rounded-2xl border border-[#1f2528]/10 bg-white overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-100 bg-[#fbfcf9] text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="px-5 py-3.5">Trigger Time</th>
                        <th className="px-5 py-3.5">Trend Topic</th>
                        <th className="px-5 py-3.5">Mode</th>
                        <th className="px-5 py-3.5">Platforms</th>
                        <th className="px-5 py-3.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-bold text-[#1f2528]">
                      {pastLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-10 text-center text-[10px] text-slate-400">
                            No automation run history recorded yet.
                          </td>
                        </tr>
                      ) : (
                        pastLogs.map((log) => {
                          const dateStr = new Date(log.created_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit"
                          });

                          return (
                            <tr key={log.id} className="hover:bg-slate-50/50 transition">
                              <td className="whitespace-nowrap px-5 py-3.5 font-bold text-slate-500">
                                {dateStr}
                              </td>
                              <td className="px-5 py-3.5 max-w-[200px] truncate">
                                {log.trend_title}
                              </td>
                              <td className="px-5 py-3.5 capitalize font-medium text-slate-400">
                                {log.mode}
                              </td>
                              <td className="px-5 py-3.5">
                                {(() => {
                                  const platforms = log.scheduled_posts?.platforms || selectedPlatforms || [];
                                  if (platforms.length === 0) return <span className="text-slate-300 font-normal">-</span>;
                                  return (
                                    <div className="flex flex-wrap gap-1 max-w-[120px]">
                                      {platforms.map((p: string) => (
                                        <span
                                          key={p}
                                          className="inline-block bg-[#2f7867]/10 border border-[#2f7867]/15 rounded px-1.5 py-0.5 text-[9px] font-black text-[#2f7867] uppercase tracking-wide"
                                        >
                                          {p}
                                        </span>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="px-5 py-3.5">
                                <span
                                  className={`inline-block rounded-md px-2 py-0.5 text-[9px] font-black border ${
                                    log.status === "published"
                                      ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                                      : log.status === "approved"
                                      ? "bg-sky-50 border-sky-200 text-sky-600"
                                      : log.status === "rejected"
                                      ? "bg-slate-50 border-slate-200 text-slate-400"
                                      : log.status === "pending"
                                      ? "bg-amber-50 border-amber-200 text-amber-600"
                                      : "bg-rose-50 border-rose-200 text-rose-500"
                                  }`}
                                >
                                  {log.status === "published"
                                    ? "Published"
                                    : log.status === "approved"
                                    ? "Approved"
                                    : log.status === "rejected"
                                    ? "Rejected"
                                    : log.status === "pending"
                                    ? "Pending Approval"
                                    : "Failed"}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
