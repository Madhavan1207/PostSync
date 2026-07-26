"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, X, Loader2, Rocket,
  Check, Clock, CalendarClock, CheckCircle2, XCircle, ExternalLink,
} from "lucide-react";
import type { WorkspaceDraft, WorkspaceDraftStatus, WorkspaceRole } from "@/types";
import { canPublish } from "@/lib/workspace/permissions";

interface Props {
  workspaceId: string;
  currentRole: WorkspaceRole;
}

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: "#0077B5", youtube: "#FF0000", bluesky: "#0085FF",
  instagram: "#E1306C", facebook: "#1877F2", twitter: "#1DA1F2",
  threads: "#000000", pinterest: "#E60023", reddit: "#FF4500",
};

type CalStatus = "scheduled" | "published" | "failed";
const STATUS_CONFIG: Record<CalStatus, { label: string; icon: React.ElementType; bg: string; text: string; border: string; dot: string }> = {
  scheduled: { label: "Scheduled", icon: Clock,        bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-400" },
  published: { label: "Published", icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-400" },
  failed:    { label: "Failed",    icon: XCircle,      bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200",    dot: "bg-rose-400" },
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["S","M","T","W","T","F","S"];

function formatTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m}${ampm}`;
}
function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${months[d.getMonth()]} ${d.getDate()}, ${hour}:${m} ${ampm}`;
}

export default function TeamMiniCalendar({ workspaceId, currentRole }: Props) {
  const router = useRouter();
  const isApprover = canPublish(currentRole);

  const [drafts, setDrafts] = useState<WorkspaceDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [dayPopup, setDayPopup] = useState<{ day: number; x: number; y: number } | null>(null);
  const [detailDraft, setDetailDraft] = useState<WorkspaceDraft | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const dayPopupRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Same-shape fetch as the workspace's own /api/workspace/drafts (never
  // personal accounts) — pull both scheduled and published so the month
  // grid shows the full picture, same as solo Calendar does with pending
  // + published scheduled_posts.
  const refresh = async () => {
    setLoading(true);
    try {
      const [schedRes, pubRes, failRes] = await Promise.all([
        fetch(`/api/workspace/drafts?status=scheduled`, { cache: "no-store" }),
        fetch(`/api/workspace/drafts?status=published`, { cache: "no-store" }),
        fetch(`/api/workspace/drafts?status=failed`, { cache: "no-store" }),
      ]);
      const [sched, pub, fail] = await Promise.all([schedRes.json(), pubRes.json(), failRes.json()]);
      const all = [...(sched.drafts || []), ...(pub.drafts || []), ...(fail.drafts || [])];
      setDrafts(all);
    } catch {
      // leave whatever we had; the toast would be noisy on a background refresh
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => { await refresh(); })();
    // No cron runs locally — this poll just keeps the grid in sync with
    // whatever the scheduler (or a teammate) does in the background,
    // mirroring solo Calendar's 30s refresh.
    const id = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(id);
  }, [workspaceId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedDay = dayPopupRef.current?.contains(target);
      const clickedDetail = detailRef.current?.contains(target);
      if (!clickedDay && !clickedDetail) {
        setDayPopup(null);
        setDetailDraft(null);
        setSelectedDay(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const draftStatus = (d: WorkspaceDraft): CalStatus =>
    d.status === "published" ? "published" : d.status === "failed" ? "failed" : "scheduled";

  // ── Publish Now ──────────────────────────────────────────
  const publishNow = async (draft: WorkspaceDraft) => {
    if (!confirm(`Publish "${draft.title || "Untitled"}" now to the workspace's connected accounts?`)) return;
    setActionLoading("publish");
    try {
      const res = await fetch(`/api/workspace/drafts/${draft.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publishing failed.");
      setDrafts((prev) => prev.map((d) => d.id === data.draft.id ? data.draft : d));
      setDetailDraft(data.draft);
      showToast("Published to the workspace's connected accounts!");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to publish", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Cancel Schedule ──────────────────────────────────────
  const cancelSchedule = async (draft: WorkspaceDraft) => {
    if (!confirm("Cancel this scheduled post? It will go back to Approved.")) return;
    setActionLoading("cancel");
    try {
      const res = await fetch(`/api/workspace/drafts/${draft.id}/cancel-schedule`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
      setDetailDraft(null);
      setDayPopup(null);
      showToast("Schedule cancelled.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to cancel schedule", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const getLocalDateString = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // ── Reschedule ───────────────────────────────────────────
  const openReschedule = (draft: WorkspaceDraft) => {
    const base = draft.scheduled_time ? new Date(draft.scheduled_time) : new Date(Date.now() + 30 * 60000);
    setRescheduleDate(getLocalDateString(base));
    setRescheduleTime(base.toTimeString().slice(0, 5));
    setRescheduleOpen(true);
  };

  const confirmReschedule = async () => {
    if (!detailDraft || !rescheduleDate || !rescheduleTime) return;
    setActionLoading("reschedule");
    try {
      const scheduled_time = new Date(`${rescheduleDate}T${rescheduleTime}`).toISOString();
      const res = await fetch(`/api/workspace/drafts/${detailDraft.id}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduled_time }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reschedule failed.");
      setDrafts((prev) => prev.map((d) => d.id === data.draft.id ? data.draft : d));
      setDetailDraft(data.draft);
      setRescheduleOpen(false);
      showToast("Post rescheduled!");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to reschedule", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Grid math ────────────────────────────────────────────
  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const draftsByDay: Record<number, WorkspaceDraft[]> = {};
  drafts.forEach((d) => {
    if (!d.scheduled_time) return;
    const dt = new Date(d.scheduled_time);
    if (dt.getFullYear() === year && dt.getMonth() === month) {
      const day = dt.getDate();
      draftsByDay[day] = [...(draftsByDay[day] || []), d];
    }
  });

  const dayPopupDrafts = dayPopup ? (draftsByDay[dayPopup.day] || []) : [];

  const handleDayClick = (day: number, e: React.MouseEvent) => {
    const dayDrafts = draftsByDay[day] || [];
    if (!dayDrafts.length) { setDayPopup(null); setSelectedDay(null); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(rect.left, window.innerWidth - 280);
    const y = Math.min(rect.bottom + 6, window.innerHeight - 320);
    setDayPopup({ day, x, y });
    setSelectedDay(day);
    setDetailDraft(null);
  };

  const handleEventClick = (draft: WorkspaceDraft, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDetailDraft(draft);
  };

  return (
    <div className="relative">
      {/* Compact card */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-bold text-gray-900">{MONTHS[month]} {year}</h3>
          <div className="flex items-center gap-1.5">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-300" />}
            <button onClick={() => setCalMonth(new Date())}
              className="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-bold text-gray-500 hover:bg-gray-50">
              Today
            </button>
            <button onClick={() => setCalMonth(new Date(year, month - 1))}
              className="flex h-6 w-6 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
              <ChevronLeft className="h-3.5 w-3.5 text-gray-500" />
            </button>
            <button onClick={() => setCalMonth(new Date(year, month + 1))}
              className="flex h-6 w-6 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
              <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-gray-50 bg-gray-50">
          {DAYS.map((d, i) => (
            <div key={i} className="py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`e${i}`} className="min-h-[64px] border-b border-r border-gray-50 bg-gray-50/40" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayDrafts = draftsByDay[day] || [];
            const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
            const isSelected = selectedDay === day;
            const colIdx = (firstDay + i) % 7;
            const totalCells = firstDay + daysInMonth;
            const isLastRow = (firstDay + i) >= totalCells - 7;

            return (
              <div key={day}
                className={`relative min-h-[64px] cursor-pointer border-b border-r border-gray-50 p-1 transition-colors
                  ${colIdx === 6 ? "border-r-0" : ""} ${isLastRow ? "border-b-0" : ""}
                  ${isSelected ? "bg-blue-50/60" : "hover:bg-gray-50"}`}
                onClick={(e) => handleDayClick(day, e)}
              >
                <div className="mb-1 flex justify-end">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold
                    ${isToday ? "bg-black text-white" : "text-gray-400"}`}>
                    {day}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {dayDrafts.slice(0, 2).map((d) => {
                    const color = PLATFORM_COLORS[d.platforms[0]] || "#94a3b8";
                    const isPublished = d.status === "published";
                    return (
                      <button key={d.id}
                        className="flex w-full items-center gap-1 overflow-hidden rounded px-1 py-0.5 text-left"
                        style={{
                          background: isPublished ? `${color}22` : `${color}dd`,
                          color: isPublished ? color : "#fff",
                        }}
                        onClick={(e) => handleEventClick(d, e)}
                      >
                        <span className="truncate text-[9px] font-semibold">{d.title || d.platforms[0]}</span>
                      </button>
                    );
                  })}
                  {dayDrafts.length > 2 && (
                    <p className="pl-1 text-[9px] font-bold text-gray-400">+{dayDrafts.length - 2} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day popup */}
      <AnimatePresence>
        {dayPopup && dayPopupDrafts.length > 0 && (
          <motion.div ref={dayPopupRef}
            initial={{ opacity: 0, scale: 0.96, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
            className="fixed z-40 w-72 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_24px_60px_rgba(31,37,40,0.18)]"
            style={{ left: dayPopup.x, top: dayPopup.y }}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{MONTHS[month]}</p>
                <p className="text-xl font-black leading-none text-gray-900">{dayPopup.day}</p>
              </div>
              <button onClick={() => { setDayPopup(null); setSelectedDay(null); setDetailDraft(null); }}
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>
            <div className="max-h-72 divide-y divide-gray-50 overflow-y-auto">
              {dayPopupDrafts.map((d) => {
                const color = PLATFORM_COLORS[d.platforms[0]] || "#94a3b8";
                const cfg = STATUS_CONFIG[draftStatus(d)];
                return (
                  <button key={d.id}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50"
                    onClick={(e) => handleEventClick(d, e)}
                  >
                    <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-gray-900">{d.title || "Untitled Draft"}</p>
                      <p className="mt-0.5 text-[11px] text-gray-400">{formatTime(d.scheduled_time)} · {d.platforms.join(", ")}</p>
                      <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
                      </span>
                    </div>
                    <ChevronRight className="mt-1.5 h-3.5 w-3.5 shrink-0 text-gray-300" />
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail panel */}
      <AnimatePresence>
        {detailDraft && (
          <motion.div ref={detailRef}
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}
            className="fixed right-4 top-24 z-40 w-80 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_24px_80px_rgba(31,37,40,0.20)]"
          >
            <div className="relative border-b border-gray-100 px-5 py-4"
              style={{ background: `linear-gradient(135deg, ${PLATFORM_COLORS[detailDraft.platforms[0]] || "#2f7867"}18, transparent)` }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap gap-1">
                    {detailDraft.platforms.map((p) => (
                      <span key={p} className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize text-white"
                        style={{ background: PLATFORM_COLORS[p] || "#94a3b8" }}>{p}</span>
                    ))}
                  </div>
                  <p className="text-base font-black leading-tight text-gray-900">{detailDraft.title || "Untitled Draft"}</p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-400">
                    <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                    {formatDateTime(detailDraft.scheduled_time)}
                  </p>
                </div>
                <button onClick={() => setDetailDraft(null)} className="shrink-0 rounded-lg p-1.5 hover:bg-black/8">
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>
              <div className="mt-3">
                {(() => {
                  const cfg = STATUS_CONFIG[draftStatus(detailDraft)];
                  const Icon = cfg.icon;
                  return (
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                      <Icon className="h-3 w-3" />{cfg.label}
                    </span>
                  );
                })()}
              </div>
            </div>

            <div className="p-4 space-y-3">
              {detailDraft.media_urls?.[0] && (
                <div className="overflow-hidden rounded-xl border border-gray-100">
                  {detailDraft.media_urls[0].match(/\.(mp4|mov|webm|avi)(\?|$)/i) ? (
                    <video src={detailDraft.media_urls[0]} className="h-40 w-full rounded-xl object-cover bg-gray-50" controls preload="metadata" />
                  ) : (
                    <img src={detailDraft.media_urls[0]} alt="" className="h-32 w-full object-cover" />
                  )}
                </div>
              )}
              {detailDraft.description && (
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">Content</p>
                  <p className="line-clamp-4 text-[13px] leading-relaxed text-gray-600">{detailDraft.description}</p>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 p-4 space-y-2">
              {/* Only Owner/Manager get scheduling controls, and only while
                  the draft is still "scheduled" — a published or failed
                  draft is handled from the full draft page, not here. */}
              {isApprover && detailDraft.status === "scheduled" && (
                <>
                  <button
                    disabled={actionLoading === "publish"}
                    onClick={() => publishNow(detailDraft)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
                  >
                    {actionLoading === "publish" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                    {actionLoading === "publish" ? "Publishing..." : "Publish Now"}
                  </button>
                  <button
                    onClick={() => openReschedule(detailDraft)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <CalendarClock className="h-3.5 w-3.5" /> Reschedule
                  </button>
                  <button
                    disabled={actionLoading === "cancel"}
                    onClick={() => cancelSchedule(detailDraft)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 disabled:opacity-40"
                  >
                    {actionLoading === "cancel" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                    Cancel Schedule
                  </button>
                </>
              )}

              <button
                onClick={() => router.push(`/drafts/workspace/${detailDraft.id}`)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open Full Draft
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reschedule modal */}
      <AnimatePresence>
        {rescheduleOpen && detailDraft && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 backdrop-blur-sm"
            onClick={() => !(actionLoading === "reschedule") && setRescheduleOpen(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
              className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}>
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Reschedule Post</h3>
                <button onClick={() => setRescheduleOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mb-5 text-sm text-gray-500">
                Rescheduling: <span className="font-bold text-gray-900">{detailDraft.title || "Untitled Draft"}</span>
              </p>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-400">Date</label>
                  <input type="date" className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-400 focus:bg-white"
                    value={rescheduleDate} min={getLocalDateString()} onChange={(e) => setRescheduleDate(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-400">Time</label>
                  <input type="time" className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-gray-400 focus:bg-white"
                    value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setRescheduleOpen(false)} disabled={actionLoading === "reschedule"}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50 disabled:opacity-40">
                  Cancel
                </button>
                <button onClick={confirmReschedule} disabled={actionLoading === "reschedule" || !rescheduleDate || !rescheduleTime}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white text-sm font-medium rounded-xl disabled:opacity-40 hover:bg-gray-800">
                  {actionLoading === "reschedule" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {actionLoading === "reschedule" ? "Updating..." : "Confirm Reschedule"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.97 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm font-bold shadow-xl
              ${toast.type === "error" ? "bg-rose-600 text-white" : "bg-gray-900 text-white"}`}>
            {toast.type === "error" ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
