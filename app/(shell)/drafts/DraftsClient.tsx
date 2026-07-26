"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Trash2, Edit3, Rocket, CalendarClock, ImageIcon,
  Video, Clock, Plus, Loader2, X, Check, Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import DraftStatusBadge from "@/components/workspace/DraftStatusBadge";
import type { Draft, WorkspaceDraft, WorkspaceRole } from "@/types";
import { canApprove, canSubmit } from "@/lib/workspace/permissions";

interface Props {
  drafts: Draft[];
  workspaceDrafts?: WorkspaceDraft[];
  currentRole?: WorkspaceRole | null;
  isInWorkspace?: boolean;
  connectedPlatforms?: string[];
}

function PlatformBadge({ platform }: { platform: string }) {
  const colors: Record<string, string> = {
    linkedin: "bg-blue-100 text-blue-700", youtube: "bg-red-100 text-red-700",
    bluesky: "bg-sky-100 text-sky-700", instagram: "bg-pink-100 text-pink-700",
    facebook: "bg-blue-100 text-blue-800", twitter: "bg-slate-100 text-slate-700",
    threads: "bg-zinc-100 text-zinc-700", pinterest: "bg-rose-100 text-rose-700",
    reddit: "bg-orange-100 text-orange-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${colors[platform] || "bg-slate-100 text-slate-600"}`}>
      {platform}
    </span>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, ${hour}:${m} ${ampm}`;
}

export default function DraftsClient({
  drafts: initialDrafts,
  workspaceDrafts: initialWorkspaceDrafts = [],
  currentRole,
  isInWorkspace = false,
  connectedPlatforms = [],
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"my" | "workspace" | "pending" | "approved">("my");
  const [drafts, setDrafts] = useState<Draft[]>(initialDrafts);
  const [workspaceDrafts] = useState<WorkspaceDraft[]>(initialWorkspaceDrafts);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [scheduleModal, setScheduleModal] = useState<Draft | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [schedulePlatforms, setSchedulePlatforms] = useState<string[]>([]);
  const [scheduling, setScheduling] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const deleteDraft = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/drafts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDrafts((p) => p.filter((d) => d.id !== id));
      showToast("Draft deleted.");
    } catch { showToast("Failed to delete draft.", "error"); }
    finally { setDeletingId(null); }
  };

  // Editing a draft now goes straight to the full Compose page —
  // pre-filled with this draft's title, caption, media, and platforms —
  // instead of the old, more limited in-page modal.
  const openEdit = (draft: Draft) => {
    router.push(`/create?draftId=${draft.id}`);
  };

  const getLocalDateString = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const openSchedule = (draft: Draft) => {
    setScheduleModal(draft);
    setSchedulePlatforms(draft.platforms.filter((p) => AVAILABLE.includes(p)));
    const now = new Date(); now.setMinutes(now.getMinutes() + 30);
    setScheduleDate(getLocalDateString(now));
    setScheduleTime(now.toTimeString().slice(0, 5));
  };

  const confirmSchedule = async () => {
    if (!scheduleModal) return;
    const hasMediaPlatform = schedulePlatforms.some((p) => ["instagram", "youtube", "pinterest"].includes(p.toLowerCase()));
    const mediaList = scheduleModal.media_urls || [];
    if (hasMediaPlatform && mediaList.length === 0) {
      showToast("Instagram, YouTube, and Pinterest require media. Please edit the draft to attach a file before scheduling.", "error");
      return;
    }
    setScheduling(true);
    try {
      const scheduled_time = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      const res = await fetch("/api/scheduled-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: scheduleModal.title, description: scheduleModal.description,
          media_urls: scheduleModal.media_urls, platforms: schedulePlatforms, scheduled_time,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to schedule post.");
      await fetch(`/api/drafts/${scheduleModal.id}`, { method: "DELETE" });
      setDrafts((p) => p.filter((d) => d.id !== scheduleModal.id));
      setScheduleModal(null);
      showToast("Post scheduled! View it in Calendar.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to schedule post.", "error");
    } finally {
      setScheduling(false);
    }
  };

  const publishNow = async (draft: Draft) => {
    if (draft.platforms.length === 0) { showToast("No platforms selected.", "error"); return; }
    setPublishingId(draft.id);
    try {
      const formData = new FormData();
      formData.set("caption", draft.description);
      formData.set("title", draft.title);
      formData.set("platforms", draft.platforms.join(","));
      if (draft.media_urls[0]) {
        formData.set("mediaUrl", draft.media_urls[0]);
        const isVideo = draft.media_urls[0].match(/\.(mp4|mov|webm|avi)(\?|$)/i);
        formData.set("mediaType", isVideo ? "video" : "image");
        // Everything past the first image — without this only image 1 of a
        // multi-image draft ever went out when hitting "Publish Now".
        const extraMediaUrls = draft.media_urls.slice(1);
        if (extraMediaUrls.length > 0) {
          formData.set("extraMediaUrls", JSON.stringify(extraMediaUrls));
        }
      }
      const res = await fetch("/api/posts/publish", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Publish failed");
      const allFailed = data.results?.every((r: { status: string }) => r.status === "failed");
      if (allFailed) throw new Error(data.results?.[0]?.message || "Publish failed");
      await fetch(`/api/drafts/${draft.id}`, { method: "DELETE" });
      setDrafts((p) => p.filter((d) => d.id !== draft.id));
      showToast("Published successfully!");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to publish.", "error");
    } finally { setPublishingId(null); }
  };

  // The Edit/Schedule platform pickers should reflect the account's
  // actual connections, not a fixed guess — falls back to the original
  // three only if nothing is connected yet, so the picker isn't empty.
  const AVAILABLE = connectedPlatforms.length ? connectedPlatforms : ["linkedin", "youtube", "bluesky"];

  // Filtered workspace drafts based on active tab
  const filteredWorkspaceDrafts = workspaceDrafts.filter((d) => {
    if (activeTab === "workspace") return true;
    if (activeTab === "pending")   return d.status === "pending_approval";
    if (activeTab === "approved")  return d.status === "approved";
    return true;
  });

  return (
    <div className="relative min-h-screen bg-[#f6f7f1] text-[#1f2528]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(43,114,100,0.08),transparent_34%),linear-gradient(315deg,rgba(208,89,69,0.07),transparent_30%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(31,37,40,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(31,37,40,0.045)_1px,transparent_1px)] bg-[size:72px_72px] opacity-50" />
      </div>
      <div className="relative mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#2f7867]/70">Content</p>
            <h1 className="mt-1 text-3xl font-black tracking-[-0.03em] text-[#1f2528]">Drafts</h1>
            <p className="mt-1 text-sm text-slate-500">
              {activeTab === "my" ? `${drafts.length} personal draft${drafts.length !== 1 ? "s" : ""}` : `${filteredWorkspaceDrafts.length} draft${filteredWorkspaceDrafts.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Button variant="primary" onClick={() => window.location.href = "/create"}>
            <Plus className="h-4 w-4" /> New Post
          </Button>
        </div>

        {/* Workspace Tabs */}
        {isInWorkspace && (
          <div className="flex gap-1 rounded-xl bg-gray-100 p-1 mb-6">
            {([
              { key: "my",        label: "My Drafts" },
              { key: "workspace", label: "Workspace Drafts" },
              { key: "pending",   label: "Pending Approval" },
              { key: "approved",  label: "Approved" },
            ] as const).map(({ key, label }) => {
              if ((key === "pending" || key === "approved") && currentRole === "creator") return null;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                    activeTab === key
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Workspace Drafts */}
        {isInWorkspace && activeTab !== "my" && (
          <div className="space-y-3">
            {filteredWorkspaceDrafts.map((draft) => (
              <div
                key={draft.id}
                onClick={() => router.push(`/drafts/workspace/${draft.id}`)}
                className="bg-white rounded-2xl border border-[#1f2528]/10 p-5 cursor-pointer hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-black text-[#1f2528] truncate">{draft.title || "Untitled"}</h3>
                      <DraftStatusBadge status={draft.status} size="sm" />
                    </div>
                    <p className="text-sm text-slate-500 truncate">{draft.description}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      By {draft.creator_name} · {formatDate(draft.updated_at)}
                    </p>
                  </div>
                  {draft.platforms?.length > 0 && (
                    <div className="flex gap-1 flex-wrap shrink-0">
                      {draft.platforms.map((p) => <PlatformBadge key={p} platform={p} />)}
                    </div>
                  )}
                </div>
                {draft.status === "rejected" && draft.rejection_reason && (
                  <div className="mt-3 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
                    Rejected: {draft.rejection_reason}
                  </div>
                )}
              </div>
            ))}
            {filteredWorkspaceDrafts.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-[#1f2528]/10 bg-white py-20 shadow-sm">
                <Users className="mb-4 h-12 w-12 text-slate-300" />
                <p className="text-lg font-bold text-slate-500">No drafts here yet</p>
              </div>
            )}
          </div>
        )}

        {/* My Drafts — original UI, unchanged */}
        {(!isInWorkspace || activeTab === "my") && (
          <>
            {drafts.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-[#1f2528]/10 bg-white py-20 shadow-sm">
                <FileText className="mb-4 h-12 w-12 text-slate-300" />
                <p className="text-lg font-bold text-slate-500">No drafts yet</p>
                <p className="mt-1 text-sm text-slate-400">Save a post as a draft and it will appear here.</p>
                <Button variant="primary" className="mt-6" onClick={() => window.location.href = "/create"}>
                  <Plus className="h-4 w-4" /> Create Post
                </Button>
              </div>
            )}
            <div className="grid gap-4">
              <AnimatePresence>
                {drafts.map((draft) => (
                  <motion.div key={draft.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                    className="group rounded-2xl border border-[#1f2528]/10 bg-white p-5 shadow-[0_4px_24px_rgba(31,37,40,0.07)] transition hover:shadow-[0_8px_32px_rgba(31,37,40,0.12)]">
                    <div className="flex gap-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#1f2528]/10 bg-[#f4f6f0]">
                        {draft.media_urls[0] ? (
                          draft.media_urls[0].match(/\.(mp4|mov|webm|avi)(\?|$)/i) ? (
                            <video src={draft.media_urls[0]} className="h-full w-full object-cover" preload="metadata" muted />
                          ) : (
                            <img src={draft.media_urls[0]} alt="" className="h-full w-full object-cover" />
                          )
                        ) : (
                          <ImageIcon className="h-7 w-7 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="truncate text-base font-black text-[#1f2528]">{draft.title || "Untitled Draft"}</h3>
                          <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                            <Clock className="h-3 w-3" />{formatDate(draft.updated_at)}
                          </div>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-500">{draft.description || "No description"}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {draft.platforms.map((p) => <PlatformBadge key={p} platform={p} />)}
                          {draft.platforms.length === 0 && <span className="text-xs text-slate-400">No platforms selected</span>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-[#1f2528]/6 pt-4">
                      <Button variant="secondary" size="sm" onClick={() => openEdit(draft)}><Edit3 className="h-3.5 w-3.5" /> Edit</Button>
                      <Button variant="secondary" size="sm" onClick={() => openSchedule(draft)}><CalendarClock className="h-3.5 w-3.5" /> Schedule</Button>
                      <Button variant="primary" size="sm" disabled={publishingId === draft.id || draft.platforms.length === 0} onClick={() => publishNow(draft)}>
                        {publishingId === draft.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                        Publish Now
                      </Button>
                      <Button variant="danger" size="sm" disabled={deletingId === draft.id} onClick={() => deleteDraft(draft.id)} className="ml-auto">
                        {deletingId === draft.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Delete
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>

      {/* Schedule Modal */}
      <AnimatePresence>
        {scheduleModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-[#1f2528]/30 p-4 backdrop-blur-xl"
            onClick={() => setScheduleModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
              className="w-full max-w-md rounded-2xl border border-[#1f2528]/10 bg-white p-6 shadow-[0_30px_100px_rgba(31,37,40,0.22)]"
              onClick={(e) => e.stopPropagation()}>
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-xl font-black text-[#1f2528]">Schedule Post</h3>
                <Button variant="ghost" size="icon" onClick={() => setScheduleModal(null)}><X className="h-4 w-4" /></Button>
              </div>
              <p className="mb-5 text-sm text-slate-500">Scheduling: <span className="font-bold text-[#1f2528]">{scheduleModal.title || "Untitled Draft"}</span></p>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Date</label>
                  <input type="date" className="w-full rounded-lg border border-[#1f2528]/12 bg-[#f9faf7] px-4 py-2.5 text-sm text-[#1f2528] outline-none focus:border-[#2f7867]/50 focus:bg-white"
                    value={scheduleDate} min={getLocalDateString()} onChange={(e) => setScheduleDate(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Time</label>
                  <input type="time" className="w-full rounded-lg border border-[#1f2528]/12 bg-[#f9faf7] px-4 py-2.5 text-sm text-[#1f2528] outline-none focus:border-[#2f7867]/50 focus:bg-white"
                    value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Platforms</label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE.map((p) => {
                      const isSelected = schedulePlatforms.includes(p);
                      const isThreads = p.toLowerCase() === "threads";
                      return (
                        <button key={p} onClick={() => setSchedulePlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])}
                          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition ${isSelected ? (isThreads ? "bg-black text-white border-black" : "bg-[#1f2528] text-white") : "border border-[#1f2528]/12 bg-white text-slate-600"}`}>
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                          <span className={isSelected ? "text-white" : ""}>{p}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setScheduleModal(null)}>Cancel</Button>
                <Button variant="primary" className="flex-1" disabled={scheduling || !scheduleDate || !scheduleTime || schedulePlatforms.length === 0} onClick={confirmSchedule}>
                  {scheduling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} Confirm Schedule
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
            className={`fixed bottom-6 right-6 z-50 rounded-2xl px-5 py-3 text-sm font-bold shadow-lg ${toast.type === "error" ? "bg-rose-600 text-white" : "bg-[#1f2528] text-white"}`}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
