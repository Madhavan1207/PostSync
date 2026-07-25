"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ImageIcon, Video, Trash2, Eye, Plus, Loader2,
  Upload, X, ExternalLink, Copy, Check, Library,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MediaLibraryItem } from "@/types";

interface Props {
  items: MediaLibraryItem[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatSize(bytes: number | null) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LibraryClient({ items: initialItems }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<MediaLibraryItem[]>(initialItems);
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaLibraryItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = items.filter((i) => filter === "all" || i.file_type === filter);
  const images = items.filter((i) => i.file_type === "image");
  const videos = items.filter((i) => i.file_type === "video");

  // Deep-link from the topbar search: "?open=<mediaId>" opens that file's
  // preview modal directly, no matter which tab/page we were on before —
  // this re-runs any time the URL's "open" param changes, not just on
  // first mount, so clicking a different search result while already on
  // this page still opens the new item.
  const openId = searchParams.get("open");
  const [appliedOpenId, setAppliedOpenId] = useState<string | null>(null);
  if (openId !== appliedOpenId) {
    setAppliedOpenId(openId);
    if (openId) {
      const match = items.find((i) => i.id === openId);
      if (match) setPreviewItem(match);
    }
  }

  const closePreview = () => {
    setPreviewItem(null);
    if (searchParams.get("open")) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("open");
      router.replace(params.toString() ? `/library?${params.toString()}` : "/library");
    }
  };

  // Listen to arrow keys for navigation
  useEffect(() => {
    if (!previewItem) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        const currentIndex = filtered.findIndex((i) => i.id === previewItem.id);
        if (currentIndex !== -1) {
          const nextIndex = (currentIndex + 1) % filtered.length;
          setPreviewItem(filtered[nextIndex]);
        }
      } else if (e.key === "ArrowLeft") {
        const currentIndex = filtered.findIndex((i) => i.id === previewItem.id);
        if (currentIndex !== -1) {
          const prevIndex = (currentIndex - 1 + filtered.length) % filtered.length;
          setPreviewItem(filtered[prevIndex]);
        }
      } else if (e.key === "Escape") {
        closePreview();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewItem, filtered]);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch("/api/media-library", { method: "POST", body: formData });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Upload failed.");
      const { item } = payload;
      setItems((prev) => [item, ...prev]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      showToast("File uploaded to library.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Upload failed.", "error");
    } finally {
      setUploading(false);
    }
  };

  const deleteItem = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/media-library/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setItems((prev) => prev.filter((i) => i.id !== id));
      showToast("File deleted.");
    } catch {
      showToast("Failed to delete file.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const deleteSelectedItems = async () => {
    if (selectedIds.length === 0) return;
    setBatchDeleting(true);
    try {
      await Promise.all(
        selectedIds.map((id) => fetch(`/api/media-library/${id}`, { method: "DELETE" }))
      );
      setItems((prev) => prev.filter((i) => !selectedIds.includes(i.id)));
      showToast(`${selectedIds.length} file${selectedIds.length > 1 ? "s" : ""} deleted.`);
      setSelectedIds([]);
    } catch {
      showToast("Failed to delete selected files.", "error");
    } finally {
      setBatchDeleting(false);
    }
  };

  const copySelectedUrls = () => {
    const selectedItems = items.filter((i) => selectedIds.includes(i.id));
    const urls = selectedItems.map((i) => i.file_url).join("\n");
    navigator.clipboard.writeText(urls);
    showToast(`${selectedItems.length} URL${selectedItems.length > 1 ? "s" : ""} copied to clipboard.`);
  };

  const createPostWithSelected = () => {
    const selectedItems = items.filter((i) => selectedIds.includes(i.id));
    if (selectedItems.length === 0) return;
    const mediaUrls = selectedItems.map((i) => i.file_url).join(",");
    router.push(`/create?mediaUrl=${encodeURIComponent(mediaUrls)}`);
  };

  const copyUrl = (item: MediaLibraryItem) => {
    navigator.clipboard.writeText(item.file_url);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const sendToComposer = (item: MediaLibraryItem) => {
    // Navigate to create page — the media URL can be pasted in
    window.location.href = `/create?mediaUrl=${encodeURIComponent(item.file_url)}`;
  };



  return (
    <div className="dashboard-light relative min-h-screen bg-[#f6f7f1] text-[#1f2528]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(43,114,100,0.08),transparent_34%),linear-gradient(315deg,rgba(208,89,69,0.07),transparent_30%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(31,37,40,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(31,37,40,0.045)_1px,transparent_1px)] bg-[size:72px_72px] opacity-50" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#2f7867]/70">Media</p>
            <h1 className="mt-1 text-3xl font-black tracking-[-0.03em] text-[#1f2528]">Content Library</h1>
            <p className="mt-1 text-sm text-slate-500">
              {images.length} image{images.length !== 1 ? "s" : ""} · {videos.length} video{videos.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,video/*"
              onChange={(e) => { if (e.target.files?.[0]) uploadFile(e.target.files[0]); }}
            />
            <Button variant="primary" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload Media
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            { label: "Total Files", value: items.length, size: items.reduce((sum, item) => sum + (item.file_size || 0), 0), icon: Library },
            { label: "Images", value: images.length, size: images.reduce((sum, item) => sum + (item.file_size || 0), 0), icon: ImageIcon },
            { label: "Videos", value: videos.length, size: videos.reduce((sum, item) => sum + (item.file_size || 0), 0), icon: Video },
          ].map(({ label, value, size, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-[#1f2528]/10 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf3ed]">
                  <Icon className="h-4 w-4 text-[#2f7867]" />
                </div>
                <div>
                  <p className="text-2xl font-black text-[#1f2528]">
                    {value} <span className="text-sm font-medium text-slate-400">({formatSize(size)})</span>
                  </p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="mb-5 flex gap-1 rounded-xl border border-[#1f2528]/10 bg-white/70 p-1 w-fit shadow-sm backdrop-blur-sm">
          {(["all", "image", "video"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`relative rounded-lg px-4 py-1.5 text-xs font-bold capitalize transition-colors duration-200 ${
                filter === f ? "text-[#1a4a3a]" : "text-slate-500 hover:text-[#1f2528]"
              }`}
            >
              {filter === f && (
                <motion.span
                  layoutId="library-filter-pill"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "8px",
                    background: "linear-gradient(135deg, rgba(47,120,103,0.20) 0%, rgba(100,190,160,0.25) 50%, rgba(47,120,103,0.16) 100%)",
                    border: "1px solid rgba(47,120,103,0.30)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                  }}
                />
              )}
              <span className="relative z-10">
                {f === "all" ? "All Media" : f === "image" ? "Images" : "Videos"}
              </span>
            </button>
          ))}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#1f2528]/10 bg-white py-20 shadow-sm">
            <ImageIcon className="mb-4 h-12 w-12 text-slate-300" />
            <p className="text-lg font-bold text-slate-500">
              {items.length === 0 ? "No media uploaded yet" : `No ${filter}s in your library`}
            </p>
            <p className="mt-1 text-sm text-slate-400">Upload images and videos to reuse across your posts.</p>
            <Button variant="primary" className="mt-6" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" /> Upload Your First File
            </Button>
          </div>
        )}

        {/* Grid */}
        {filtered.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <AnimatePresence>
              {filtered.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={cn(
                      "group relative cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(31,37,40,0.14)]",
                      isSelected ? "ring-2 ring-[#2f7867] border-transparent scale-[0.98]" : "border-[#1f2528]/10"
                    )}
                    onClick={() => setPreviewItem(item)}
                  >
                    {/* Top-Left Google Photos Selection Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIds((prev) =>
                          prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
                        );
                      }}
                      className={cn(
                        "absolute top-2.5 left-2.5 z-20 flex h-6 w-6 items-center justify-center rounded-full border transition-all cursor-pointer shadow-md",
                        isSelected
                          ? "border-[#2f7867] bg-[#2f7867] text-white scale-110 ring-2 ring-[#2f7867]/30"
                          : "border-white/90 bg-black/40 text-transparent hover:border-white hover:bg-black/60 group-hover:opacity-100 opacity-90"
                      )}
                      title={isSelected ? "Deselect item" : "Select item"}
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </button>

                    <div className="relative aspect-[4/3] w-full bg-[#f4f6f0]">
                      {item.file_type === "image" ? (
                        <img src={item.file_url} alt={item.file_name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="relative h-full w-full">
                          <video
                            src={item.file_url}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                            preload="metadata"
                            muted
                          />
                          <div className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm">
                            <Video className="h-3 w-3" />
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Google Photos Style Floating Multi-Select Action Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-slate-700/80 bg-[#1f2528]/95 px-5 py-3 shadow-2xl backdrop-blur-xl text-white"
          >
            <div className="flex items-center gap-2 border-r border-slate-600/70 pr-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2f7867] text-xs font-black text-white">
                {selectedIds.length}
              </span>
              <span className="text-xs font-bold tracking-wide">
                {selectedIds.length} Selected
              </span>
            </div>

            {/* Select All / Deselect All Toggle */}
            <button
              type="button"
              onClick={() => {
                if (selectedIds.length === filtered.length) {
                  setSelectedIds([]);
                } else {
                  setSelectedIds(filtered.map((i) => i.id));
                }
              }}
              className="rounded-xl bg-slate-700/60 px-3 py-1.5 text-xs font-bold hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
            >
              {selectedIds.length === filtered.length ? "Deselect All" : "Select All"}
            </button>

            {/* Copy URLs */}
            <button
              type="button"
              onClick={copySelectedUrls}
              className="flex items-center gap-1.5 rounded-xl bg-slate-700/60 px-3 py-1.5 text-xs font-bold hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Copy URLs</span>
            </button>

            {/* Create Post with Selected */}
            <button
              type="button"
              onClick={createPostWithSelected}
              className="flex items-center gap-1.5 rounded-xl bg-[#2f7867] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#256254] transition-colors cursor-pointer shadow-md"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Post</span>
            </button>

            {/* Delete Selected */}
            <button
              type="button"
              onClick={() => void deleteSelectedItems()}
              disabled={batchDeleting}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600/90 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-600 transition-colors cursor-pointer disabled:opacity-50"
            >
              {batchDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              <span>Delete ({selectedIds.length})</span>
            </button>

            {/* Dismiss */}
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="ml-1 text-slate-400 hover:text-white cursor-pointer p-1"
              title="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewItem && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl"
            style={{ background: "rgba(31,37,40,0.55)" }}
            onClick={() => closePreview()}
          >
            {/* Left navigation arrow */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const currentIndex = filtered.findIndex((i) => i.id === previewItem.id);
                if (currentIndex !== -1) {
                  const prevIndex = (currentIndex - 1 + filtered.length) % filtered.length;
                  setPreviewItem(filtered[prevIndex]);
                }
              }}
              className="mr-6 hidden h-14 w-14 items-center justify-center rounded-full bg-white/10 text-white border border-white/20 shadow transition hover:bg-white/25 md:flex shrink-0 active:scale-90"
              title="Previous"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: "spring", stiffness: 340, damping: 28 }}
              className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-[#1f2528]/12 bg-white/92 shadow-[0_32px_80px_rgba(31,37,40,0.22)] backdrop-blur-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#1f2528]/10 bg-[#f6f7f1]/60 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#1f2528]">{previewItem.file_name}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{previewItem.file_type === "image" ? "Image" : "Video"} · {previewItem.file_size ? `${(previewItem.file_size / 1024).toFixed(0)} KB` : ""}</p>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <a
                    href={previewItem.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#1f2528]/12 bg-white text-[#46535a] shadow-sm transition hover:bg-[#f2f4ef] hover:text-[#1f2528]"
                    title="Open original"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => closePreview()}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#1f2528]/12 bg-white text-[#46535a] shadow-sm transition hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200"
                    title="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Media */}
              <div className="bg-[#f0f2ec] p-3">
                {previewItem.file_type === "image" ? (
                  <img
                    src={previewItem.file_url}
                    alt={previewItem.file_name}
                    className="max-h-[65vh] w-full rounded-xl object-contain shadow-sm"
                  />
                ) : (
                  <video
                    src={previewItem.file_url}
                    controls
                    className="max-h-[65vh] w-full rounded-xl bg-[#1a1f22] shadow-sm"
                  />
                )}
              </div>

              {/* Footer */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#1f2528]/10 bg-[#f6f7f1]/60 px-5 py-4">
                <div>
                  <p className="text-xs font-bold text-[#1f2528]">{previewItem.file_name}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Uploaded {new Date(previewItem.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {previewItem.file_size ? ` · ${formatSize(previewItem.file_size)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => deleteItem(previewItem.id)}
                    disabled={deletingId === previewItem.id}
                    className="flex h-10 items-center justify-center gap-1.5 border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100 disabled:opacity-50 px-4 rounded-xl text-xs font-bold transition"
                  >
                    {deletingId === previewItem.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Delete
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => copyUrl(previewItem)}
                    className="flex h-10 items-center justify-center gap-1.5 border-[#1f2528]/10 bg-white hover:bg-[#f4f6f0] px-4 rounded-xl text-xs font-bold text-[#1f2528] transition"
                  >
                    {copiedId === previewItem.id ? (
                      <>
                        <Check className="h-4 w-4 text-[#2f7867]" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 text-slate-500" />
                        Copy URL
                      </>
                    )}
                  </Button>
                  <button
                    onClick={() => { sendToComposer(previewItem); setPreviewItem(null); }}
                    className="btn-liquid-glass relative flex h-10 items-center gap-2 rounded-xl px-5 text-xs font-bold text-[#1a3d34] shadow-[0_4px_16px_rgba(47,120,103,0.18)]"
                  >
                    <Plus className="h-4 w-4 relative z-10" />
                    <span className="relative z-10">Use in Post</span>
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Right navigation arrow */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const currentIndex = filtered.findIndex((i) => i.id === previewItem.id);
                if (currentIndex !== -1) {
                  const nextIndex = (currentIndex + 1) % filtered.length;
                  setPreviewItem(filtered[nextIndex]);
                }
              }}
              className="ml-6 hidden h-14 w-14 items-center justify-center rounded-full bg-white/10 text-white border border-white/20 shadow transition hover:bg-white/25 md:flex shrink-0 active:scale-90"
              title="Next"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
            className={`fixed bottom-6 right-6 z-50 rounded-2xl px-5 py-3 text-sm font-bold shadow-lg ${
              toast.type === "error" ? "bg-rose-600 text-white" : "bg-[#1f2528] text-white"
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
