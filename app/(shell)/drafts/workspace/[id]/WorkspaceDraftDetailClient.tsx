"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Send, Check, X, CalendarClock, Rocket, Loader2,
  Trash2, Pencil, History, XCircle,
} from "lucide-react";
import DraftStatusBadge from "@/components/workspace/DraftStatusBadge";
import CommentThread from "@/components/workspace/CommentThread";
import type { WorkspaceDraft, WorkspaceDraftComment, WorkspaceRole } from "@/types";
import { canApprove, canSubmit, canPublish, canEditDraft } from "@/lib/workspace/permissions";

interface Props {
  draft:        WorkspaceDraft;
  comments:     WorkspaceDraftComment[];
  currentRole:  WorkspaceRole;
  currentUserId: string;
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, ${hour}:${m} ${ampm}`;
}

export default function WorkspaceDraftDetailClient({
  draft: initialDraft,
  comments: initialComments,
  currentRole,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [draft, setDraft]         = useState(initialDraft);
  const [comments, setComments]   = useState(initialComments);
  const [loading, setLoading]     = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  // ── Schedule / Reschedule modal (opens directly on this page — no
  // navigation to Compose) ─────────────────────────────────────
  const [scheduleModal, setScheduleModal] = useState<"schedule" | "reschedule" | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduling, setScheduling] = useState(false);

  const isCreator  = draft.created_by === currentUserId;
  const isApprover = canApprove(currentRole); // owner or manager
  const isOwner    = currentRole === "owner";

  const showFeedback = (msg: string, isError = false) => {
    if (isError) setError(msg);
    else setSuccess(msg);
    setTimeout(() => { setError(null); setSuccess(null); }, 4000);
  };

  // ── Submit for approval ────────────────────────────────────
  const handleSubmit = async () => {
    setLoading("submit");
    try {
      const res  = await fetch(`/api/workspace/drafts/${draft.id}/submit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDraft(data.draft);
      showFeedback("Draft submitted for approval!");
    } catch (e) {
      showFeedback(e instanceof Error ? e.message : "Failed to submit", true);
    } finally {
      setLoading(null);
    }
  };

  // ── Approve ────────────────────────────────────────────────
  const handleApprove = async () => {
    setLoading("approve");
    try {
      const res  = await fetch(`/api/workspace/drafts/${draft.id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDraft(data.draft);
      showFeedback("Draft approved!");
    } catch (e) {
      showFeedback(e instanceof Error ? e.message : "Failed to approve", true);
    } finally {
      setLoading(null);
    }
  };

  // ── Reject ─────────────────────────────────────────────────
  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setLoading("reject");
    try {
      const res  = await fetch(`/api/workspace/drafts/${draft.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDraft(data.draft);
      setShowRejectInput(false);
      setRejectReason("");
      showFeedback("Draft rejected.");
    } catch (e) {
      showFeedback(e instanceof Error ? e.message : "Failed to reject", true);
    } finally {
      setLoading(null);
    }
  };

  // ── Delete (Owner can always delete; Creator only their own
  // draft/rejected drafts) ───────────────────────────────────
  const handleDelete = async () => {
    if (!confirm("Delete this draft? This can't be undone.")) return;
    setLoading("delete");
    try {
      const res = await fetch(`/api/workspace/drafts/${draft.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      router.push("/drafts");
    } catch (e) {
      showFeedback(e instanceof Error ? e.message : "Failed to delete", true);
      setLoading(null);
    }
  };

  // ── Publish Now — calls the publish API directly and stays on
  // this page. No redirect to Compose. ───────────────────────
  const handlePublishNow = async () => {
    if (!confirm(`Publish "${draft.title || "Untitled"}" now to the workspace's connected accounts?`)) return;
    setLoading("publish");
    setError(null);
    try {
      const res  = await fetch(`/api/workspace/drafts/${draft.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.draft) setDraft(data.draft);
      if (!res.ok) throw new Error(data.error || "Publishing failed.");
      showFeedback("Published to the workspace's connected accounts!");
    } catch (e) {
      showFeedback(e instanceof Error ? e.message : "Failed to publish", true);
    } finally {
      setLoading(null);
    }
  };

  const getLocalDateString = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // ── Schedule / Reschedule modal open+submit ─────────────────
  const openScheduleModal = (mode: "schedule" | "reschedule") => {
    const base = mode === "reschedule" && draft.scheduled_time ? new Date(draft.scheduled_time) : new Date(Date.now() + 30 * 60000);
    setScheduleDate(getLocalDateString(base));
    setScheduleTime(base.toTimeString().slice(0, 5));
    setScheduleModal(mode);
  };

  const confirmSchedule = async () => {
    if (!scheduleModal || !scheduleDate || !scheduleTime) return;
    setScheduling(true);
    setError(null);
    try {
      const scheduled_time = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      const res = await fetch(`/api/workspace/drafts/${draft.id}/publish`, {
        method: scheduleModal === "reschedule" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduled_time }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scheduling failed.");
      setDraft(data.draft);
      setScheduleModal(null);
      showFeedback(scheduleModal === "reschedule" ? "Post rescheduled!" : "Post scheduled!");
    } catch (e) {
      showFeedback(e instanceof Error ? e.message : "Failed to schedule", true);
    } finally {
      setScheduling(false);
    }
  };

  // ── Cancel Schedule ─────────────────────────────────────────
  const handleCancelSchedule = async () => {
    if (!confirm("Cancel this scheduled post? It will go back to Approved.")) return;
    setLoading("cancel");
    try {
      const res  = await fetch(`/api/workspace/drafts/${draft.id}/cancel-schedule`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDraft(data.draft);
      showFeedback("Schedule cancelled.");
    } catch (e) {
      showFeedback(e instanceof Error ? e.message : "Failed to cancel schedule", true);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">

      {/* Back */}
      <button
        onClick={() => router.push("/drafts")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Drafts
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">

          {/* Header */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-bold text-gray-900">{draft.title || "Untitled"}</h1>
              <DraftStatusBadge status={draft.status} />
            </div>
            <p className="text-sm text-gray-500">
              By {draft.creator_name} · {new Date(draft.created_at).toLocaleDateString()}
            </p>
            {draft.platforms?.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {draft.platforms.map((p) => (
                  <span key={p} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full capitalize">{p}</span>
                ))}
              </div>
            )}
            {(draft.status === "scheduled" || draft.status === "published") && draft.scheduled_time && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <CalendarClock className="h-3.5 w-3.5" />
                {draft.status === "scheduled" ? "Scheduled for " : "Published at "}{formatDateTime(draft.scheduled_time)}
              </div>
            )}
          </div>

          {/* Media — every attached image/video, not just the first */}
          {draft.media_urls && draft.media_urls.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className={draft.media_urls.length > 1 ? "grid grid-cols-2 gap-3" : ""}>
                {draft.media_urls.map((url, i) => (
                  /\.(mp4|mov|webm|avi)/i.test(url) ? (
                    <video key={i} src={url} controls className="w-full rounded-xl max-h-80 object-cover" />
                  ) : (
                    <img key={i} src={url} alt={`Media ${i + 1}`} className="w-full rounded-xl max-h-80 object-cover" />
                  )
                ))}
              </div>
            </div>
          )}

          {/* Caption */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Content</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {draft.description || <span className="text-gray-400 italic">No content</span>}
            </p>
          </div>

          {/* Approval history */}
          {(draft.reviewed_by || draft.rejection_reason) && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-3">
                <History className="h-4 w-4" /> Approval History
              </h2>
              <p className="text-sm text-gray-600">
                {draft.status === "rejected" ? "Rejected" : draft.status === "failed" ? "Reviewed" : "Last reviewed"}
                {draft.reviewer_name ? ` by ${draft.reviewer_name}` : ""}
                {draft.reviewed_at ? ` · ${formatDateTime(draft.reviewed_at)}` : ""}
              </p>
            </div>
          )}

          {/* Rejection / failure reason */}
          {(draft.status === "rejected" || draft.status === "failed") && draft.rejection_reason && (
            <div className="bg-red-50 rounded-2xl border border-red-100 p-5">
              <p className="text-sm font-semibold text-red-700 mb-1">
                {draft.status === "failed" ? "Publish Failed" : "Rejection Reason"}
              </p>
              <p className="text-sm text-red-600">{draft.rejection_reason}</p>
            </div>
          )}

          {/* Feedback */}
          {error   && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
          {success && <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-600 font-medium">✓ {success}</div>}

          {/* Actions */}
          <div className="flex flex-wrap gap-3">

            {/* Creator: Edit opens Compose (only remaining nav-away action) */}
            {isCreator && (draft.status === "draft" || draft.status === "rejected") && canEditDraft(currentRole) && (
              <button
                onClick={() => router.push(`/team?tab=compose&draftId=${draft.id}`)}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                <Pencil className="h-4 w-4" /> Edit
              </button>
            )}

            {isCreator && (draft.status === "draft" || draft.status === "rejected") && canSubmit(currentRole) && (
              <button
                onClick={handleSubmit}
                disabled={loading === "submit"}
                className="flex items-center gap-2 px-4 py-2.5 bg-black text-white text-sm font-medium rounded-xl disabled:opacity-40 hover:bg-gray-800 transition-colors"
              >
                {loading === "submit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {loading === "submit" ? "Submitting..." : "Submit for Approval"}
              </button>
            )}

            {/* Manager/Owner: approve / reject a pending draft */}
            {isApprover && draft.status === "pending_approval" && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={loading === "approve"}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl disabled:opacity-40 hover:bg-green-700 transition-colors"
                >
                  <Check className="h-4 w-4" />
                  {loading === "approve" ? "Approving..." : "Approve"}
                </button>

                {!showRejectInput ? (
                  <button
                    onClick={() => setShowRejectInput(true)}
                    className="flex items-center gap-2 px-4 py-2.5 border border-red-200 text-red-500 text-sm font-medium rounded-xl hover:bg-red-50 transition-colors"
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </button>
                ) : (
                  <div className="w-full flex gap-2">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection..."
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                    <button
                      onClick={handleReject}
                      disabled={loading === "reject" || !rejectReason.trim()}
                      className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-xl disabled:opacity-40"
                    >
                      {loading === "reject" ? "..." : "Confirm"}
                    </button>
                    <button
                      onClick={() => setShowRejectInput(false)}
                      className="px-3 py-2 border border-gray-200 text-sm rounded-xl hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Manager/Owner: approved drafts get Schedule / Publish Now —
                both open a modal right here, never Compose. */}
            {isApprover && draft.status === "approved" && (
              <>
                <button
                  onClick={() => openScheduleModal("schedule")}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
                >
                  <CalendarClock className="h-4 w-4" />
                  Schedule
                </button>
                <button
                  onClick={handlePublishNow}
                  disabled={loading === "publish"}
                  className="flex items-center gap-2 px-4 py-2.5 bg-black text-white text-sm font-medium rounded-xl disabled:opacity-40 hover:bg-gray-800 transition-colors"
                >
                  {loading === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                  {loading === "publish" ? "Publishing..." : "Publish Now"}
                </button>
              </>
            )}

            {/* Manager/Owner: scheduled drafts get Reschedule / Cancel */}
            {isApprover && draft.status === "scheduled" && (
              <>
                <button
                  onClick={() => openScheduleModal("reschedule")}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
                >
                  <CalendarClock className="h-4 w-4" />
                  Reschedule
                </button>
                <button
                  onClick={handleCancelSchedule}
                  disabled={loading === "cancel"}
                  className="flex items-center gap-2 px-4 py-2.5 border border-red-200 text-red-500 text-sm font-medium rounded-xl disabled:opacity-40 hover:bg-red-50 transition-colors"
                >
                  {loading === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Cancel Schedule
                </button>
              </>
            )}

            {/* Owner only: Edit Post (Compose) + Delete, available whenever
                the draft isn't in a state where Creator already owns those
                actions. */}
            {isOwner && (draft.status === "approved" || draft.status === "scheduled" || draft.status === "pending_approval" || draft.status === "published" || draft.status === "failed") && (
              <button
                onClick={() => router.push(`/team?tab=compose&draftId=${draft.id}`)}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                <Pencil className="h-4 w-4" /> Edit Post
              </button>
            )}

            {(isOwner || (isCreator && (draft.status === "draft" || draft.status === "rejected"))) && (
              <button
                onClick={handleDelete}
                disabled={loading === "delete"}
                className="flex items-center gap-2 px-4 py-2.5 border border-red-200 text-red-500 text-sm font-medium rounded-xl disabled:opacity-40 hover:bg-red-50 transition-colors ml-auto"
              >
                {loading === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Sidebar — Comments */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 h-fit">
          <CommentThread
            draftId={draft.id}
            comments={comments}
            canComment={canApprove(currentRole) || isCreator}
            onCommentAdded={(c) => setComments((prev) => [...prev, c])}
          />
        </div>
      </div>

      {/* Schedule / Reschedule modal — opens directly on this page */}
      <AnimatePresence>
        {scheduleModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 backdrop-blur-sm"
            onClick={() => !scheduling && setScheduleModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
              className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}>
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  {scheduleModal === "reschedule" ? "Reschedule Post" : "Schedule Post"}
                </h3>
                <button onClick={() => setScheduleModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mb-5 text-sm text-gray-500">
                {scheduleModal === "reschedule" ? "Rescheduling" : "Scheduling"}:{" "}
                <span className="font-bold text-gray-900">{draft.title || "Untitled Draft"}</span>
              </p>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-400">Date</label>
                  <input type="date" className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-400 focus:bg-white"
                    value={scheduleDate} min={getLocalDateString()} onChange={(e) => setScheduleDate(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-400">Time</label>
                  <input type="time" className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-400 focus:bg-white"
                    value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setScheduleModal(null)} disabled={scheduling}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50 disabled:opacity-40">
                  Cancel
                </button>
                <button onClick={confirmSchedule} disabled={scheduling || !scheduleDate || !scheduleTime}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white text-sm font-medium rounded-xl disabled:opacity-40 hover:bg-gray-800">
                  {scheduling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                  {scheduleModal === "reschedule" ? "Confirm Reschedule" : "Confirm Schedule"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
