"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, X, Loader2, Rocket,
  Trash2, Edit3, Check, Clock, CalendarClock,
  CheckCircle2, XCircle, AlertCircle, ImageIcon, Video
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScheduledPost, ScheduledPostStatus } from "@/types";

interface Props { posts: ScheduledPost[] }

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: "#0077B5", youtube: "#FF0000", bluesky: "#0085FF",
  instagram: "#E1306C", facebook: "#1877F2", twitter: "#1DA1F2",
  threads: "#000000", pinterest: "#E60023", reddit: "#FF4500",
  discord: "#5865F2", telegram: "#26A5E4",
};

type StatusConfig = { label: string; icon: React.ElementType; bg: string; text: string; border: string; dot: string };
const STATUS_CONFIG: Record<ScheduledPostStatus, StatusConfig> = {
  pending:    { label: "Scheduled", icon: Clock,         bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-400" },
  publishing: { label: "Publishing", icon: Loader2,       bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    dot: "bg-blue-400" },
  published:  { label: "Published", icon: CheckCircle2,  bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-400" },
  failed:     { label: "Failed",    icon: XCircle,       bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200",    dot: "bg-rose-400" },
  cancelled:  { label: "Cancelled", icon: AlertCircle,   bg: "bg-slate-50",   text: "text-slate-500",   border: "border-slate-200",   dot: "bg-slate-300" },
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function formatTime(iso: string) {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m} ${ampm}`;
}
function formatDateTime(iso: string) {
  const d = new Date(iso);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, ${hour}:${m} ${ampm}`;
}

function PlatformPill({ platform }: { platform: string }) {
  const color = PLATFORM_COLORS[platform] || "#94a3b8";
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize text-white"
      style={{ background: color }}>
      {platform}
    </span>
  );
}

function StatusPill({ status }: { status: ScheduledPostStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <Icon className="h-3 w-3" />{cfg.label}
    </span>
  );
}

export default function CalendarClient({ posts: initialPosts }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<ScheduledPost[]>(initialPosts);
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [dayPopup, setDayPopup] = useState<{ day: number; x: number; y: number } | null>(null);
  const [detailPost, setDetailPost] = useState<ScheduledPost | null>(null);
  const [editModal, setEditModal] = useState<ScheduledPost | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const dayPopupRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Deep-link from the topbar search: "?open=<postId>" opens that post's
  // detail panel directly, jumping the calendar to its month if needed —
  // this re-runs whenever the URL's "open" param changes (not just on
  // first mount), so clicking a different search result while already on
  // this page still opens the new post.
  const openId = searchParams.get("open");
  const [appliedOpenId, setAppliedOpenId] = useState<string | null>(null);
  if (openId !== appliedOpenId) {
    setAppliedOpenId(openId);
    if (openId) {
      const match = posts.find((p) => p.id === openId);
      if (match) {
        setDetailPost(match);
        setCalMonth(new Date(match.scheduled_time));
        setDayPopup(null);
      }
    }
  }


  // Dismiss the detail panel, and if it was opened via a "?open=" deep
  // link from search, strip that param so re-visiting the page later
  // doesn't keep popping it back open.
  const closeDetail = () => {
    setDetailPost(null);
    if (searchParams.get("open")) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("open");
      router.replace(params.toString() ? `/calendar?${params.toString()}` : "/calendar");
    }
  };

  // Close popups on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedDay = dayPopupRef.current?.contains(target);
      const clickedDetail = detailRef.current?.contains(target);
      if (!clickedDay && !clickedDetail) {
        setDayPopup(null);
        closeDetail();
        setSelectedDay(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const refreshPosts = async () => {
    const res = await fetch("/api/scheduled-posts", { cache: "no-store" });
    if (!res.ok) return;
    const { posts } = await res.json();
    setPosts(posts || []);
  };

  // Poll the server for schedule changes. The initial catch-up refresh is
  // scheduled as a task rather than run inline so this effect only ever
  // subscribes — state lands from the fetch/interval callbacks.
  useEffect(() => {
    const initial = window.setTimeout(() => void refreshPosts(), 0);
    const id = window.setInterval(() => void refreshPosts(), 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(id);
    };
  }, []);

  const deletePost = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/scheduled-posts/${id}`, { method: "DELETE" });
      setPosts((p) => p.filter((x) => x.id !== id));
      setDetailPost(null); setDayPopup(null);
      showToast("Post deleted.");
    } catch { showToast("Delete failed.", "error"); }
    finally { setDeletingId(null); }
  };

  const cancelPost = async (post: ScheduledPost) => {
    setCancellingId(post.id);
    try {
      const res = await fetch(`/api/scheduled-posts/${post.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const { post: updated } = await res.json();
      setPosts((p) => p.map((x) => x.id === updated.id ? updated : x));
      setDetailPost(updated);
      showToast("Schedule cancelled.");
    } catch { showToast("Cancel failed.", "error"); }
    finally { setCancellingId(null); }
  };

  const publishNow = async (post: ScheduledPost) => {
    setPublishingId(post.id);
    try {
      const isYouTube = post.platforms.includes("youtube");
      const hasYouTubeVideoId = !!post.youtube_video_id;

      if (isYouTube && hasYouTubeVideoId) {
        // YouTube video is already uploaded as private — just flip it to public
        const res = await fetch("/api/media/publish-youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ youtube_video_id: post.youtube_video_id }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "YouTube publish failed");
        }
      } else {
        // Non-YouTube or no pre-uploaded video: use normal publish route
        const formData = new FormData();
        formData.set("caption", post.description);
        formData.set("title", post.title);
        formData.set("platforms", post.platforms.filter((p) => p !== "youtube").join(","));
        if (post.media_urls[0]) {
          formData.set("mediaUrl", post.media_urls[0]);
          formData.set("mediaType", post.media_urls[0].match(/\.(mp4|mov|webm|avi)(\?|$)/i) ? "video" : "image");
          // Everything past the first image — without this only image 1 of a
          // multi-image scheduled post ever went out when publishing it early.
          const extraMediaUrls = post.media_urls.slice(1);
          if (extraMediaUrls.length > 0) {
            formData.set("extraMediaUrls", JSON.stringify(extraMediaUrls));
          }
        }
        const res = await fetch("/api/posts/publish", { method: "POST", body: formData });
        if (!res.ok) throw new Error();
      }

      await fetch(`/api/scheduled-posts/${post.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });
      const updated = { ...post, status: "published" as ScheduledPostStatus };
      setPosts((p) => p.map((x) => x.id === post.id ? updated : x));
      setDetailPost(updated);
      showToast("Published successfully!");
    } catch (e) { showToast(e instanceof Error ? e.message : "Publish failed.", "error"); }
    finally { setPublishingId(null); }
  };

  const getLocalDateString = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const openEdit = (post: ScheduledPost) => {
    setEditModal(post);
    const dt = new Date(post.scheduled_time);
    setEditDate(getLocalDateString(dt));
    setEditTime(dt.toTimeString().slice(0, 5));
    setDetailPost(null); setDayPopup(null);
  };

  const saveEdit = async () => {
    if (!editModal) return;
    setSaving(true);
    try {
      const scheduled_time = new Date(`${editDate}T${editTime}`).toISOString();
      const res = await fetch(`/api/scheduled-posts/${editModal.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduled_time }),
      });
      const { post } = await res.json();
      setPosts((p) => p.map((x) => x.id === post.id ? post : x));
      setEditModal(null);
      showToast("Schedule updated.");
    } catch { showToast("Update failed.", "error"); }
    finally { setSaving(false); }
  };

  // Calendar grid
  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const postsByDay: Record<number, ScheduledPost[]> = {};
  posts.filter((p) => p.status !== "cancelled").forEach((p) => {
    const d = new Date(p.scheduled_time);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      postsByDay[day] = [...(postsByDay[day] || []), p];
    }
  });

  const dayPopupPosts = dayPopup ? (postsByDay[dayPopup.day] || []) : [];

const handleDayClick = (day: number, e: React.MouseEvent) => {
    const dayPosts = postsByDay[day] || [];
    if (!dayPosts.length) { setDayPopup(null); setSelectedDay(null); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // Use viewport-relative positioning (fixed), not page-relative
    const x = Math.min(rect.left, window.innerWidth - 300);
    const y = Math.min(rect.bottom + 6, window.innerHeight - 320);
    setDayPopup({ day, x, y });
    setSelectedDay(day);
    setDetailPost(null);
  };

  const handleEventClick = (post: ScheduledPost, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDetailPost(post);
    // Keep dayPopup open so user can click other posts
  };

  // Stats
  const pending = posts.filter((p) => p.status === "pending").length;
  const published = posts.filter((p) => p.status === "published").length;
  const failed = posts.filter((p) => p.status === "failed").length;

  return (
    <div className="relative min-h-screen bg-[#f6f7f1] text-[#1f2528]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(43,114,100,0.08),transparent_34%)]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#2f7867]/70">Scheduling</p>
          <h1 className="mt-1 text-3xl font-black tracking-[-0.03em]">Content Calendar</h1>
        </div>

        {/* Stats strip */}
        <div className="mb-5 flex gap-3">
          {[
            { label: "Scheduled", value: pending,   color: "text-amber-600",   bg: "bg-amber-50 border-amber-200" },
            { label: "Published", value: published, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
            { label: "Failed",    value: failed,    color: "text-rose-600",    bg: "bg-rose-50 border-rose-200" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`rounded-2xl border px-5 py-3 ${bg}`}>
              <p className={`text-2xl font-black ${color}`}>{value}</p>
              <p className="text-xs font-semibold text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Calendar card */}
        <div className="overflow-hidden rounded-2xl border border-[#1f2528]/10 bg-white shadow-sm">
          {/* Nav */}
          <div className="flex items-center justify-between border-b border-[#1f2528]/8 px-6 py-4">
            <h2 className="text-xl font-black text-[#1f2528]">{MONTHS[month]} {year}</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setCalMonth(new Date())}
                className="rounded-lg border border-[#1f2528]/12 px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-[#f4f6f0]">
                Today
              </button>
              <button onClick={() => setCalMonth(new Date(year, month - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1f2528]/12 hover:bg-[#f4f6f0]">
                <ChevronLeft className="h-4 w-4 text-slate-500" />
              </button>
              <button onClick={() => setCalMonth(new Date(year, month + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1f2528]/12 hover:bg-[#f4f6f0]">
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </button>
            </div>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 border-b border-[#1f2528]/6 bg-[#fafaf9]">
            {DAYS.map((d) => (
              <div key={d} className="py-2.5 text-center text-[11px] font-bold uppercase tracking-widest text-slate-400">{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e${i}`} className="min-h-[100px] border-b border-r border-[#1f2528]/5 bg-[#fafaf9]" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayPosts = postsByDay[day] || [];
              const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
              const isSelected = selectedDay === day;
              const colIdx = (firstDay + i) % 7;
              const totalCells = firstDay + daysInMonth;
              const isLastRow = (firstDay + i) >= totalCells - 7;

              return (
                <div key={day}
                  className={`relative min-h-[100px] cursor-pointer border-b border-r border-[#1f2528]/5 p-2 transition-colors
                    ${colIdx === 6 ? "border-r-0" : ""}
                    ${isLastRow ? "border-b-0" : ""}
                    ${isSelected ? "bg-[#f0f7f4]" : "hover:bg-[#f9faf7]"}`}
                  onClick={(e) => handleDayClick(day, e)}
                >
                  {/* Date number */}
                  <div className="mb-1.5 flex justify-end">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold
                      ${isToday ? "bg-[#2f7867] text-white" : "text-slate-500 hover:bg-[#eaf3ed] hover:text-[#2f7867]"}`}>
                      {day}
                    </span>
                  </div>

                  {/* Event pills */}
                  <div className="space-y-0.5">
                    {dayPosts.slice(0, 3).map((p) => {
                      const color = PLATFORM_COLORS[p.platforms[0]] || "#94a3b8";
                      const isPublished = p.status === "published";
                      return (
                        <button key={p.id}
                          className="flex w-full items-center gap-1 overflow-hidden rounded-md px-1.5 py-0.5 text-left transition hover:brightness-95"
                          style={{
                            background: isPublished ? `${color}22` : `${color}dd`,
                            color: isPublished ? color : "#fff",
                            border: isPublished ? `1px solid ${color}44` : "none",
                          }}
                          onClick={(e) => handleEventClick(p, e)}
                        >
                          <span className="shrink-0 text-[9px] font-black opacity-90">{formatTime(p.scheduled_time).replace(" ", "")}</span>
                          <span className="truncate text-[9px] font-semibold opacity-95">{p.title || p.platforms[0]}</span>
                        </button>
                      );
                    })}
                    {dayPosts.length > 3 && (
                      <p className="pl-1 text-[9px] font-bold text-slate-400">+{dayPosts.length - 3} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Day popup — list of all posts that day */}
      <AnimatePresence>
        {dayPopup && dayPopupPosts.length > 0 && (
          <motion.div ref={dayPopupRef}
            key="day-popup"
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="fixed z-40 w-72 overflow-hidden rounded-2xl border border-[#1f2528]/12 bg-white shadow-[0_24px_60px_rgba(31,37,40,0.18)]"
            style={{ left: dayPopup.x, top: dayPopup.y }}
          >
            <div className="flex items-center justify-between border-b border-[#1f2528]/8 px-4 py-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{MONTHS[month]}</p>
                <p className="text-xl font-black leading-none text-[#1f2528]">{dayPopup.day}</p>
              </div>
              <button onClick={() => { setDayPopup(null); setSelectedDay(null); closeDetail(); }}
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[#f4f6f0]">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div className="max-h-72 divide-y divide-[#1f2528]/6 overflow-y-auto">
              {dayPopupPosts.map((post) => {
                const color = PLATFORM_COLORS[post.platforms[0]] || "#94a3b8";
                const cfg = STATUS_CONFIG[post.status];
                return (
                  <button key={post.id}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[#f9faf7]"
                    onClick={(e) => handleEventClick(post, e)}
                  >
                    <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#1f2528]">{post.title || "Untitled Post"}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{formatTime(post.scheduled_time)} · {post.platforms.join(", ")}</p>
                      <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
                      </span>
                    </div>
                    <ChevronRight className="mt-1.5 h-3.5 w-3.5 shrink-0 text-slate-300" />
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Post detail side panel */}
      <AnimatePresence>
        {detailPost && (
          <motion.div ref={detailRef}
            key="detail"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            className="fixed right-4 top-24 z-40 w-80 overflow-hidden rounded-2xl border border-[#1f2528]/12 bg-white shadow-[0_24px_80px_rgba(31,37,40,0.20)]"
          >
            {/* Header */}
            <div className="relative border-b border-[#1f2528]/8 px-5 py-4"
              style={{ background: `linear-gradient(135deg, ${PLATFORM_COLORS[detailPost.platforms[0]] || "#2f7867"}18, transparent)` }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap gap-1">
                    {detailPost.platforms.map((p) => <PlatformPill key={p} platform={p} />)}
                  </div>
                  <p className="text-base font-black leading-tight text-[#1f2528]">
                    {detailPost.title || "Untitled Post"}
                  </p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                    {formatDateTime(detailPost.scheduled_time)}
                  </p>
                </div>
                <button onClick={() => closeDetail()}
                  className="shrink-0 rounded-lg p-1.5 transition hover:bg-black/8">
                  <X className="h-4 w-4 text-slate-400" />
                </button>
              </div>
              <div className="mt-3">
                <StatusPill status={detailPost.status} />
              </div>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
              {/* Media thumbnail */}
              {detailPost.media_urls[0] && (
                <div className="overflow-hidden rounded-xl border border-[#1f2528]/8">
                  {detailPost.media_urls[0].match(/\.(mp4|mov|webm|avi)(\?|$)/i) ? (
                    <video
                      src={detailPost.media_urls[0]}
                      className="h-40 w-full rounded-xl object-cover bg-[#f4f6f0]"
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <img src={detailPost.media_urls[0]} alt="" className="h-32 w-full object-cover" />
                  )}
                </div>
              )}

              {/* Description */}
              {detailPost.description && (
                <div className="rounded-xl bg-[#f9faf7] p-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Content</p>
                  <p className="line-clamp-4 text-[13px] leading-relaxed text-slate-600">{detailPost.description}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="border-t border-[#1f2528]/8 p-4 space-y-2">
              {/* Only show Edit button for non-published posts */}
              {detailPost.status !== "published" && (
                <Button variant="secondary" size="sm" className="w-full" onClick={() => openEdit(detailPost)}>
                  <Edit3 className="h-3.5 w-3.5" /> Edit Schedule
                </Button>
              )}

              {detailPost.status === "pending" && (
                <>
                  <Button variant="primary" size="sm" className="w-full"
                    disabled={publishingId === detailPost.id}
                    onClick={() => publishNow(detailPost)}>
                    {publishingId === detailPost.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Rocket className="h-3.5 w-3.5" />}
                    {publishingId === detailPost.id ? "Publishing..." : "Publish Now"}
                  </Button>
                  <Button variant="secondary" size="sm" className="w-full text-amber-600 border-amber-200 hover:bg-amber-50"
                    disabled={cancellingId === detailPost.id}
                    onClick={() => cancelPost(detailPost)}>
                    {cancellingId === detailPost.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <X className="h-3.5 w-3.5" />}
                    Cancel Schedule
                  </Button>
                </>
              )}

              {(detailPost.status === "failed" || detailPost.status === "cancelled") && (
                <Button variant="primary" size="sm" className="w-full"
                  disabled={publishingId === detailPost.id}
                  onClick={() => publishNow(detailPost)}>
                  {publishingId === detailPost.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Rocket className="h-3.5 w-3.5" />}
                  Retry Publish
                </Button>
              )}

              <Button variant="ghost" size="sm"
                className="w-full text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                disabled={deletingId === detailPost.id}
                onClick={() => deletePost(detailPost.id)}>
                {deletingId === detailPost.id
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Trash2 className="h-3.5 w-3.5" />}
                Delete Post
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Schedule Modal */}
      <AnimatePresence>
        {editModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-[#1f2528]/40 p-4 backdrop-blur-sm"
            onClick={() => setEditModal(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
              className="w-full max-w-md overflow-hidden rounded-2xl border border-[#1f2528]/10 bg-white shadow-[0_30px_100px_rgba(31,37,40,0.25)]"
              onClick={(e) => e.stopPropagation()}>
              {/* Modal header */}
              <div className="border-b border-[#1f2528]/8 px-6 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Reschedule</p>
                    <h3 className="mt-0.5 text-xl font-black text-[#1f2528]">{editModal.title || "Untitled Post"}</h3>
                  </div>
                  <button onClick={() => setEditModal(null)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#f4f6f0]">
                    <X className="h-4 w-4 text-slate-400" />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {editModal.platforms.map((p) => <PlatformPill key={p} platform={p} />)}
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">New Date</label>
                  <input type="date"
                    className="w-full rounded-xl border border-[#1f2528]/12 bg-[#f9faf7] px-4 py-3 text-sm text-[#1f2528] outline-none focus:border-[#2f7867]/50 focus:bg-white"
                    value={editDate} min={getLocalDateString()}
                    onChange={(e) => setEditDate(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">New Time</label>
                  <input type="time"
                    className="w-full rounded-xl border border-[#1f2528]/12 bg-[#f9faf7] px-4 py-3 text-sm text-[#1f2528] outline-none focus:border-[#2f7867]/50 focus:bg-white"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)} />
                </div>
              </div>

              <div className="border-t border-[#1f2528]/8 px-6 py-4 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setEditModal(null)}>Cancel</Button>
                <Button variant="primary" className="flex-1" disabled={saving} onClick={saveEdit}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {saving ? "Updating..." : "Update Schedule"}
                </Button>
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
              ${toast.type === "error" ? "bg-rose-600 text-white" : "bg-[#1f2528] text-white"}`}>
            {toast.type === "error" ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
