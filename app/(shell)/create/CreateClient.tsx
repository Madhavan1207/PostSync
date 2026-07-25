"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarClock,
  Check,
  CircleDashed,
  FileText,
  Globe,
  Hash,
  Image as ImageIcon,
  Library,
  Link2,
  Loader2,
  Paperclip,
  RadioTower,
  Rocket,
  Send,
  Smile,
  Sparkles,
  Video,
  X,
  Heart,
  MessageCircle,
  Repeat2,
  Share2,
  Bookmark,
  ThumbsUp,
  MoreHorizontal,
  Eye,
  ArrowBigUp,
  Trash2,
} from "lucide-react";
import {
  getConnectedFacebookAccount,
  getConnectedInstagramAccount,
  getConnectedYouTubeAccount,
  getConnectedThreadsAccount,
  getConnectedBlueskyAccount,
  getConnectedPinterestAccount,
  getConnectedLinkedInAccount,
  getConnectedDiscordAccount,
  getConnectedTelegramAccount,
  type SocialAccount,
} from "@/lib/integrations/social-accounts";
import { cn } from "@/lib/utils";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PLATFORM_CONFIG } from "@/types";

interface User {
  id?: string;
  email?: string | null;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
    name?: string;
  };
}

interface Props {
  user: User;
  socialAccounts: SocialAccount[];
  initialMediaUrl?: string;
  // Full set of media URLs when editing an existing multi-image draft —
  // initialMediaUrl above only ever carries the first one, which is why
  // editing a 2+ image draft used to show just a single image.
  initialMediaUrls?: string[];
  initialTitle?: string;
  initialCaption?: string;
  initialPlatforms?: string[];
  isInWorkspace?: boolean;
  workspaceDraftId?: string | null;
  // Editing an existing personal draft (arrived via Drafts > Edit) —
  // saving must update that draft in place instead of creating a new one.
  personalDraftId?: string | null;
  // "workspace" renders the exact same Compose UI but saves to the
  // workspace's shared drafts instead of the signed-in user's personal
  // ones, hides Schedule/Publish (those happen from the Drafts page),
  // and scopes the quick Bluesky connect to the workspace's account.
  composeTarget?: "personal" | "workspace";
  workspaceId?: string | null;
  youtubeStatus: string | null;
  metaStatus: string | null;
  instagramStatus: string | null;
  twitterStatus: string | null;
  threadsStatus: string | null;
  blueskyStatus: string | null;
  pinterestStatus: string | null;
  youtubeMessage: string | null;
  metaMessage: string | null;
  instagramMessage: string | null;
  twitterMessage: string | null;
  threadsMessage: string | null;
  blueskyMessage: string | null;
  pinterestMessage: string | null;
  linkedinStatus: string | null;
  linkedinMessage: string | null;
  redditStatus: string | null;
  redditMessage: string | null;
}

type PlatformKey =
  | "instagram" | "facebook" | "linkedin" | "youtube"
  | "twitter" | "threads" | "bluesky" | "pinterest" | "reddit"
  | "discord" | "telegram";

type Platform = {
  id: PlatformKey;
  name: string;
  shortName: string;
  color: string;
  accent: string;
  connected: boolean;
  handle: string;
  avatarUrl?: string | null;
  lastSync: string;
  health: "excellent" | "good" | "attention" | "offline";
};

type PublishResult = {
  platform: PlatformKey;
  status: "published" | "skipped" | "failed";
  message: string;
  id?: string;
};

type MediaLibraryItem = {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
};

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };

// Narrows the `cond && {...}` entries used to build the per-platform counter
// rows, so the surviving entries keep their object type instead of `false`.
function isPresent<T>(value: T | false): value is T {
  return value !== false;
}

function PlatformLogo({ id, className, style }: { id: string; className?: string; style?: React.CSSProperties }) {
  const isWhite = className?.includes("text-white");
  const effectiveStyle = isWhite ? { color: "#ffffff", fill: "#ffffff", ...style } : style;

  if (id === "facebook") return (
    <svg className={className} style={effectiveStyle} viewBox="0 0 24 24" role="img" aria-label="Facebook">
      <path fill="currentColor" d="M14.2 8.4V6.7c0-.8.5-1 1.1-1h1.5V2.2A20 20 0 0 0 14 2c-2.9 0-4.8 1.7-4.8 4.9v1.5H6v3.9h3.2V22h4v-9.7h3.1l.6-3.9h-3.7Z" />
    </svg>
  );
  if (id === "instagram") return (
    <svg className={className} style={effectiveStyle} viewBox="0 0 24 24" role="img" aria-label="Instagram">
      <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.4" cy="6.6" r="1.3" fill="currentColor" />
    </svg>
  );
  if (id === "linkedin") return (
    <svg className={className} style={effectiveStyle} viewBox="0 0 24 24" role="img" aria-label="LinkedIn">
      <path fill="currentColor" d="M5.1 8.9h3.6V20H5.1V8.9Zm1.8-5.5a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2ZM10.8 8.9h3.5v1.5h.1c.5-.9 1.7-1.9 3.4-1.9 3.7 0 4.4 2.4 4.4 5.6V20h-3.6v-5.2c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V20h-3.6V8.9Z" />
    </svg>
  );
  if (id === "twitter") return (
    <svg className={className} style={effectiveStyle} viewBox="0 0 24 24" role="img" aria-label="X">
      <path fill="currentColor" d="M14.1 10.4 21.7 2h-1.8l-6.6 7.3L8 2H2l8 11.2L2 22h1.8l7-7.7L16.4 22H22l-7.9-11.6Zm-2.5 2.8-.8-1.1L4.4 3.3h2.7l5.2 7.2.8 1.1 6.7 9.2h-2.7l-5.5-7.6Z" />
    </svg>
  );
  if (id === "youtube") return (
    <svg className={className} style={effectiveStyle} viewBox="0 0 24 24" role="img" aria-label="YouTube">
      <path fill="currentColor" d="M22 7.3a3 3 0 0 0-2.1-2.1C18 4.7 12 4.7 12 4.7s-6 0-7.9.5A3 3 0 0 0 2 7.3 31 31 0 0 0 1.5 12 31 31 0 0 0 2 16.7a3 3 0 0 0 2.1 2.1c1.9.5 7.9.5 7.9.5s6 0 7.9-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-4.7.5-4.7s0-2.8-.5-4.7ZM10 15.4V8.6l5.8 3.4-5.8 3.4Z" />
    </svg>
  );
  if (id === "threads") return (
    <svg className={className} style={effectiveStyle} viewBox="0 0 24 24" role="img" aria-label="Threads">
      <path fill="currentColor" d="M12.1 22c-5.7 0-9.3-3.7-9.3-9.8C2.8 6.1 6.5 2 12 2c4.2 0 7.4 2.1 8.7 5.7l-3.4 1c-.8-2.3-2.7-3.6-5.2-3.6-3.3 0-5.4 2.7-5.4 7s2.1 6.8 5.5 6.8c2.6 0 4.3-1.3 4.3-3.2 0-1.1-.6-1.9-1.8-2.3-.6 2.2-2.3 3.5-4.6 3.5-2.6 0-4.4-1.6-4.4-3.9 0-2.4 2-4 5.1-4 .6 0 1.2 0 1.8.1-.3-1.2-1.2-1.8-2.6-1.8-1.1 0-2.1.4-3 1.2L5.6 6.2c1.2-1.1 2.8-1.7 4.6-1.7 3.3 0 5.2 1.8 5.6 5.4 2.8.8 4.4 2.8 4.4 5.5 0 4-3.1 6.6-8.1 6.6Zm-1.8-7.8c1.2 0 2-.8 2.3-2.3-.6-.1-1.1-.1-1.7-.1-1.4 0-2.2.5-2.2 1.3 0 .7.6 1.1 1.6 1.1Z" />
    </svg>
  );
  if (id === "pinterest") return (
    <svg className={className} style={effectiveStyle} viewBox="0 0 24 24" role="img" aria-label="Pinterest">
      <path fill="currentColor" d="M12.1 2C6.6 2 3 5.6 3 10.3c0 3 1.7 5.3 4.2 6.2.4.1.6-.2.7-.5l.3-1.3c.1-.4.1-.5-.2-.9-.8-.9-1.2-2-1.2-3.2 0-3.5 2.6-6.5 6.8-6.5 3.7 0 5.7 2.3 5.7 5.3 0 4-1.8 7.3-4.4 7.3-1.4 0-2.5-1.2-2.1-2.7.4-1.8 1.2-3.7 1.2-5 0-1.2-.6-2.1-1.9-2.1-1.5 0-2.7 1.5-2.7 3.6 0 1.3.4 2.2.4 2.2l-1.8 7.4c-.4 1.8-.1 3.9 0 4.1.1.1.2.1.3 0 .1-.2 1.8-2.2 2.4-4.2l.7-2.7c.7 1.3 2 2.1 3.7 2.1 4.9 0 8.2-4.5 8.2-10.4C23 5 19.2 2 12.1 2Z" />
    </svg>
  );
  if (id === "reddit") return (
    <svg className={className} style={effectiveStyle} viewBox="0 0 24 24" role="img" aria-label="Reddit">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15" />
      <path fill="currentColor" d="M20 12a2 2 0 0 0-2-2 2 2 0 0 0-1.3.5A9.6 9.6 0 0 0 12.6 9l.8-3.6 2.5.5a1.5 1.5 0 1 0 .2-.9l-2.8-.6a.4.4 0 0 0-.5.3l-.9 4a9.6 9.6 0 0 0-4.2 1.4A2 2 0 0 0 4 12a2 2 0 0 0 1 1.7 3.6 3.6 0 0 0 0 .5c0 2.5 2.7 4.5 6 4.5s6-2 6-4.5a3.6 3.6 0 0 0 0-.5A2 2 0 0 0 20 12Zm-11.5 1a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm5.6 2.7a3.6 3.6 0 0 1-4.2 0 .4.4 0 0 1 .5-.6 2.8 2.8 0 0 0 3.2 0 .4.4 0 0 1 .5.6Zm-.1-1.7a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
    </svg>
  );
  if (id === "discord") return (
    <svg className={className} style={effectiveStyle} viewBox="0 0 24 24" role="img" aria-label="Discord">
      <path fill="currentColor" d="M19.27 4.73a.12.12 0 0 0-.07-.05A19.53 19.53 0 0 0 14.44 3a.09.09 0 0 0-.08.04c-.21.37-.45.87-.61 1.25a18.8 18.8 0 0 0-5.5 0c-.16-.38-.41-.88-.63-1.25a.09.09 0 0 0-.08-.04A19.53 19.53 0 0 0 2.8 4.68a.12.12 0 0 0-.07.05A19.73 19.73 0 0 0 .5 17.58a.12.12 0 0 0 .05.08A19.64 19.64 0 0 0 6 21a.1.1 0 0 0 .11-.04c.43-.59.82-1.22 1.15-1.88a.1.1 0 0 0-.05-.13 13.06 13.06 0 0 1-1.84-.87.1.1 0 0 1-.01-.17c.12-.09.24-.18.36-.28a.1.1 0 0 1 .1-.01c3.57 1.63 7.45 1.63 11 0a.1.1 0 0 1 .1.01c.12.1.24.19.36.28a.1.1 0 0 1-.01.17 12.23 12.23 0 0 1-1.84.87.1.1 0 0 0-.05.13c.33.66.72 1.29 1.15 1.88a.1.1 0 0 0 .11.04 19.64 19.64 0 0 0 5.48-3.34.12.12 0 0 0 .05-.08 19.73 19.73 0 0 0-2.28-12.85M8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42S6.84 10.5 8.02 10.5s2.17 1.08 2.16 2.41S9.2 15.33 8.02 15.33m7.96 0c-1.18 0-2.16-1.08-2.16-2.42s.97-2.41 2.16-2.41 2.17 1.08 2.16 2.41-.98 2.42-2.16 2.42" />
    </svg>
  );
  if (id === "telegram") return (
    <svg className={className} style={effectiveStyle} viewBox="0 0 24 24" role="img" aria-label="Telegram">
      <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.67-.52.36-.97.53-1.33.52-.4-.01-1.18-.23-1.76-.41-.71-.23-1.28-.35-1.23-.74.03-.2.3-.41.82-.62 3.2-1.39 5.34-2.31 6.42-2.76 3.06-1.27 3.69-1.49 4.11-1.5.09 0 .3.02.43.13.11.09.14.22.15.31 0 .06.01.12 0 .19z" />
    </svg>
  );
  if (id === "bluesky") return (
    <svg className={className} style={effectiveStyle} viewBox="0 0 24 24" role="img" aria-label="Bluesky">
      <path fill="currentColor" d="M7.2 4.2c2 1.5 4.1 4.5 4.8 6.1.7-1.6 2.8-4.6 4.8-6.1 1.5-1.1 3.9-2 3.9.7 0 .5-.3 4.5-.9 5.2-1.1 1.3-4.9 1.2-6.2 1.1 4.5.7 5.7 3 3.2 5.3-4.7 4.3-6.8-1.1-7.3-2.5-.1-.3-.2-.5-.2-.5s-.1.2-.2.5c-.6 1.4-2.7 6.8-7.3 2.5-2.5-2.3-1.3-4.6 3.2-5.3-1.3.1-5.1.2-6.2-1.1C2.3 9.4 2 5.4 2 4.9c0-2.7 2.4-1.8 3.9-.7Z" />
    </svg>
  );
  return (
    <svg className={className} style={effectiveStyle} viewBox="0 0 24 24" role="img" aria-label="Fallback">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function UserAvatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  if (src) return <img src={src} alt="" className={cn("rounded-full object-cover", className)} />;
  return (
    <span className={cn("inline-flex items-center justify-center rounded-full bg-white text-slate-950 font-black", className)}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export default function CreateClient({
  user,
  socialAccounts,
  initialMediaUrl = "",
  initialMediaUrls = [],
  initialTitle = "",
  initialCaption = "",
  initialPlatforms,
  workspaceDraftId = null,
  personalDraftId = null,
  composeTarget = "personal",
  workspaceId = null,
}: Props) {
  const router = useRouter();
  const [caption, setCaption] = useState(initialCaption);
  const [postTitle, setPostTitle] = useState(initialTitle);
  const [mood, setMood] = useState("");
  const [tags, setTags] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [location, setLocation] = useState("");
  const [mediaUrl, setMediaUrl] = useState(initialMediaUrl);
  // `attachment` holds a single non-image file (video or document) — those
  // stay single-attachment since platforms only accept one video per post.
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  // `imageAttachments` holds MULTIPLE images — social platforms support
  // posting several images at once, so adding a new image appends to this
  // list instead of replacing whatever was already attached.
  const [imageAttachments, setImageAttachments] = useState<File[]>([]);
  const [imageAttachmentPreviews, setImageAttachmentPreviews] = useState<string[]>([]);
  const [selectedImageIndices, setSelectedImageIndices] = useState<number[]>([]);
  const MAX_IMAGE_ATTACHMENTS = 10;
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const [libraryItems, setLibraryItems] = useState<MediaLibraryItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [libraryAttachingId, setLibraryAttachingId] = useState<string | null>(null);

  // AI Assist Modal State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPromptTopic, setAiPromptTopic] = useState("");
  const [aiMode, setAiMode] = useState<"caption" | "hooks" | "hashtags" | "cta" | "rewrite">("caption");
  const [aiTone, setAiTone] = useState("Authentic");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const [aiError, setAiError] = useState("");

  const [translateOpen, setTranslateOpen] = useState(false);
  const [translating, setTranslating] = useState(false);

  const handleGenerateAiText = async () => {
    setAiLoading(true);
    setAiError("");
    setAiResult("");
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: aiMode,
          topic: aiPromptTopic || postTitle || caption || "Trending social media update",
          tone: aiTone,
          existingContent: caption,
          count: 1
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setAiResult(data.result);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI generation failed");
    } finally {
      setAiLoading(false);
    }
  };
  const handleTranslateText = async (targetLang: string) => {
    if (!caption.trim()) return;
    setTranslating(true);
    setAiError("");
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: caption,
          targetLang,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Translation failed");
      setCaption(data.translatedText);
      setTranslateOpen(false);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Google Translate failed");
    } finally {
      setTranslating(false);
    }
  };

  const handleAddEmojisToText = async () => {
    if (!caption.trim()) return;
    setAiLoading(true);
    setAiError("");
    try {
      const lower = caption.toLowerCase();
      const matchedEmojis: string[] = [];

      const keywordRules: Array<{ keywords: string[]; emoji: string }> = [
        { keywords: ["stage", "room", "crowd", "audience", "speech", "talk", "owned"], emoji: "🎤" },
        { keywords: ["politics", "president", "trump", "biden", "election", "vote", "government"], emoji: "🏛️" },
        { keywords: ["wild", "history", "chapter", "time", "world", "history-making"], emoji: "📜" },
        { keywords: ["love", "heart", "favorite", "like"], emoji: "❤️" },
        { keywords: ["fire", "hot", "trending", "wild", "great"], emoji: "🔥" },
        { keywords: ["rocket", "launch", "growth", "future"], emoji: "🚀" },
        { keywords: ["money", "profit", "business", "deal"], emoji: "💼" },
        { keywords: ["star", "top", "winner"], emoji: "⭐" },
        { keywords: ["shock", "unbelievable", "crazy", "assassination", "grit"], emoji: "💥" },
      ];

      for (const item of keywordRules) {
        if (item.keywords.some((k) => lower.includes(k))) {
          if (!matchedEmojis.includes(item.emoji)) {
            matchedEmojis.push(item.emoji);
          }
        }
      }

      if (matchedEmojis.length === 0) {
        matchedEmojis.push("✨", "🚀", "🔥");
      }

      const sentences = caption.split(/(?<=[.!?])\s+/);
      let newText = caption;

      if (sentences.length <= 1) {
        newText = `${caption} ${matchedEmojis.join(" ")}`;
      } else {
        newText = sentences
          .map((sentence, idx) => {
            const emojiForSentence = matchedEmojis[idx % matchedEmojis.length];
            if (emojiForSentence && !sentence.includes(emojiForSentence)) {
              return `${sentence} ${emojiForSentence}`;
            }
            return sentence;
          })
          .join(" ");
      }

      setCaption(newText);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Emoji addition failed");
    } finally {
      setAiLoading(false);
    }
  };

  const insertEmoji = (emoji: string) => {
    setCaption((prev) => (prev ? `${prev} ${emoji}` : emoji));
  };
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(() => {
    if (initialPlatforms?.length) return initialPlatforms;
    if (composeTarget === "workspace") {
      // A brand-new Team draft should default to whatever the workspace
      // actually has connected, not the solo defaults — an empty
      // workspace shows no pre-selected platforms rather than three
      // misleadingly-selected but disconnected ones.
      return Array.from(new Set(socialAccounts.filter((a) => a.status === "connected").map((a) => a.platform)));
    }
    return ["linkedin", "youtube", "bluesky"];
  });
  const [activeTab, setActiveTab] = useState<"image" | "video">(
    initialMediaUrl.match(/\.(mp4|mov|webm|avi)(\?|$)/i) ? "video" : "image"
  );
  const [publishModal, setPublishModal] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishResults, setPublishResults] = useState<PublishResult[]>([]);
  const [draftSaved, setDraftSaved] = useState(false);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleSuccess, setScheduleSuccess] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [blueskyModal, setBlueskyModal] = useState(false);
  const [blueskyHandle, setBlueskyHandle] = useState("");
  const [blueskyPassword, setBlueskyPassword] = useState("");
  const [blueskyLoading, setBlueskyLoading] = useState(false);
  const [blueskyError, setBlueskyError] = useState<string | null>(null);
  // Which platform tab is active in the preview panel
  const [previewTab, setPreviewTab] = useState<string>("");

  const attachmentInputRef = useRef<HTMLInputElement>(null);

  // True whenever this Compose instance is bound to a workspace draft —
  // either editing an existing one, or (from the Team Compose tab)
  // authoring a brand-new one. Either way, Schedule/Publish live on the
  // Drafts page, not here, and saves go to the workspace, not personally.
  const isWorkspaceMode = Boolean(workspaceDraftId) || composeTarget === "workspace";

  const [uploadStatusText, setUploadStatusText] = useState<string | null>(null);
  const [uploadProgressMap, setUploadProgressMap] = useState<Record<string, number>>({});

  const isUploadingMedia = useMemo(() => {
    return Object.values(uploadProgressMap).some((pct) => pct >= 0 && pct < 100);
  }, [uploadProgressMap]);

  const overallUploadProgress = useMemo(() => {
    const values = Object.values(uploadProgressMap).filter((pct) => pct >= 0 && pct <= 100);
    if (values.length === 0) return 100;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }, [uploadProgressMap]);

  async function uploadFileToMediaLibrary(file: File): Promise<string> {
    const key = file.name;
    const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm|avi|m4v)(\?|$)/i.test(file.name);
    if (isVideo && file.size > 45 * 1024 * 1024) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      const errMsg = `Video "${file.name}" (${sizeMB} MB) exceeds the 45 MB upload limit. Please compress your video before attaching.`;
      setPublishError(errMsg);
      setUploadStatusText(null);
      throw new Error(errMsg);
    }
    // Step 0: Fast Local Deduplication Check — If this file is already in the user's Media Library, reuse it instantly with 0 upload wait!
    try {
      const libRes = await fetch("/api/media-library");
      if (libRes.ok) {
        const libData = await libRes.json();
        const existingItem = (libData.items as MediaLibraryItem[])?.find(
          (item) =>
            item.file_name === file.name &&
            (item.file_size === file.size || Math.abs(item.file_size - file.size) < 100)
        );
        if (existingItem?.file_url) {
          setUploadProgressMap((prev) => ({ ...prev, [key]: 100 }));
          setUploadStatusText(null);
          return existingItem.file_url;
        }
      }
    } catch {
      // Ignore library check error and proceed with upload
    }

    setUploadProgressMap((prev) => ({ ...prev, [key]: 5 }));

    // Smooth 0% to 90% progress interpolation tick
    let currentProgress = 5;
    const progressInterval = setInterval(() => {
      if (currentProgress < 90) {
        const increment = currentProgress < 40 ? Math.floor(Math.random() * 8 + 6) : Math.floor(Math.random() * 4 + 2);
        currentProgress = Math.min(90, currentProgress + increment);
        setUploadProgressMap((prev) => ({ ...prev, [key]: currentProgress }));
      }
    }, 200);

    const finishProgress = (finalUrl: string) => {
      clearInterval(progressInterval);
      setUploadProgressMap((prev) => ({ ...prev, [key]: 100 }));
      setUploadStatusText(null);
      return finalUrl;
    };

    const maxRetries = 3;
    let lastError = "";

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const attemptLabel = attempt > 1 ? ` (attempt ${attempt}/${maxRetries})` : "";
        const fileKind = file.type.startsWith("video/") ? "video" : "image";
        setUploadStatusText(`Uploading ${fileKind} "${file.name}" to media storage${attemptLabel}... Please wait.`);

        // Step 1: Direct Client-to-Supabase Storage Upload (Bypasses Next.js HTTP 413 Payload Too Large Limit!)
        try {
          const supabase = createBrowserClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const fileExt = file.name.split(".").pop() || "bin";
            const timeStamp = file.lastModified || Date.now();
            const randomSuffix = Math.random().toString(36).slice(2);
            const storagePath = `${user.id}/${timeStamp}-${randomSuffix}.${fileExt}`;

            const { data: uploadData, error: uploadErr } = await supabase.storage
              .from("media-library")
              .upload(storagePath, file, { cacheControl: "3600", upsert: true });

            if (!uploadErr && uploadData?.path) {
              const { data: { publicUrl } } = supabase.storage.from("media-library").getPublicUrl(uploadData.path);

              const dbRes = await fetch("/api/media-library", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  file_name: file.name,
                  file_url: publicUrl,
                  file_type: fileKind,
                  file_size: file.size,
                })
              });
              const dbData = await dbRes.json().catch(() => ({}));
              if (dbRes.ok && (dbData.item?.file_url || publicUrl)) {
                return finishProgress(dbData.item?.file_url || publicUrl);
              }
            } else if (uploadErr) {
              console.warn("[Media Upload] Direct Supabase storage upload error:", uploadErr.message);
            }
          }
        } catch (directErr) {
          console.warn("[Media Upload] Direct upload error, trying fallback route:", directErr);
        }

        // Step 2: Fallback to FormData POST for smaller files
        const formData = new FormData();
        formData.set("file", file);

        const res = await fetch("/api/media-library", { method: "POST", body: formData });
        const payload = await res.json().catch(() => ({}));

        if (res.ok && payload.item?.file_url) {
          return finishProgress(payload.item.file_url);
        }

        lastError = payload.error || `HTTP ${res.status}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Network upload error";
      }

      if (attempt < maxRetries) {
        console.warn(`[Media Upload] Attempt ${attempt} failed: ${lastError}. Retrying in 1.5s...`);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    clearInterval(progressInterval);
    setUploadStatusText(null);
    setUploadProgressMap((prev) => ({ ...prev, [key]: 100 }));
    throw new Error(`Failed to upload "${file.name}" to media storage: ${lastError}`);
  }

  function addImageAttachments(files: File[]) {
    if (files.length === 0) return;
    setImageAttachments((prev) => {
      const room = Math.max(0, MAX_IMAGE_ATTACHMENTS - prev.length);
      const added = files.slice(0, room);
      added.forEach((f) => void uploadFileToMediaLibrary(f));
      return [...prev, ...added];
    });
    setImageAttachmentPreviews((prev) => {
      const room = Math.max(0, MAX_IMAGE_ATTACHMENTS - prev.length);
      return [...prev, ...files.slice(0, room).map((f) => URL.createObjectURL(f))];
    });
    if (attachment) { if (attachmentPreview) URL.revokeObjectURL(attachmentPreview); setAttachment(null); setAttachmentPreview(null); }
    setActiveTab("image");
  }

  useEffect(() => {
    return () => { if (attachmentPreview) URL.revokeObjectURL(attachmentPreview); };
  }, [attachmentPreview]);

  // Editing an existing draft that has more than one image — pull every
  // one of them (not just media_urls[0]) into the gallery, the same way
  // freshly-attached images work, so all of them show up and all of them
  // get saved back on Save/Schedule/Publish. Runs once on mount only.
  useEffect(() => {
    if (initialMediaUrls.length <= 1) return;
    let cancelled = false;
    (async () => {
      const files = await Promise.all(
        initialMediaUrls.map(async (url, i) => {
          try {
            const res = await fetch(url);
            if (!res.ok) return null;
            const blob = await res.blob();
            const urlPath = url.split("?")[0];
            const ext = urlPath.split(".").pop() || "jpg";
            return new File([blob], `image-${i + 1}.${ext}`, { type: blob.type || "image/jpeg" });
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      const loaded = files.filter((f): f is File => f !== null);
      if (loaded.length > 0) {
        // getDurableMediaUrls() prefers `mediaUrl` over the gallery when
        // set, so it must be cleared here or the extra images would be
        // silently dropped again the moment this draft is saved.
        setMediaUrl("");
        addImageAttachments(loaded);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Creator";

  const youtubeAccount = getConnectedYouTubeAccount(socialAccounts);
  const facebookAccount = getConnectedFacebookAccount(socialAccounts);
  const instagramAccount = getConnectedInstagramAccount(socialAccounts);
  const threadsAccount = getConnectedThreadsAccount(socialAccounts);
  const blueskyAccount = getConnectedBlueskyAccount(socialAccounts);
  const pinterestAccount = getConnectedPinterestAccount(socialAccounts);
  const linkedinAccount = getConnectedLinkedInAccount(socialAccounts);
  const discordAccount = getConnectedDiscordAccount(socialAccounts);
  const telegramAccount = getConnectedTelegramAccount(socialAccounts);

  const platforms = useMemo<Platform[]>(() => [
    { id: "instagram", name: "Instagram", shortName: "IG", color: "#E1306C", accent: "from-pink-500 via-rose-400 to-orange-300", connected: Boolean(instagramAccount), handle: instagramAccount?.account_name ? `@${instagramAccount.account_name.replace(/^@/, "")}` : "Ready to connect", avatarUrl: instagramAccount?.account_avatar_url, lastSync: instagramAccount ? "Synced 2 min ago" : "Not connected", health: instagramAccount ? "excellent" : "offline" },
    { id: "facebook", name: "Facebook", shortName: "FB", color: "#1877F2", accent: "from-blue-500 via-sky-400 to-cyan-300", connected: Boolean(facebookAccount), handle: facebookAccount?.account_name || "Ready to connect", avatarUrl: facebookAccount?.account_avatar_url, lastSync: facebookAccount ? "Synced 2 min ago" : "Not connected", health: facebookAccount ? "excellent" : "offline" },
    { id: "linkedin", name: "LinkedIn", shortName: "in", color: "#0A66C2", accent: "from-sky-500 via-blue-400 to-indigo-400", connected: Boolean(linkedinAccount), handle: linkedinAccount?.account_name || "Ready to connect", avatarUrl: linkedinAccount?.account_avatar_url, lastSync: linkedinAccount ? "Synced just now" : "Not connected", health: linkedinAccount ? "good" : "offline" },
    { id: "youtube", name: "YouTube", shortName: "YT", color: "#FF0033", accent: "from-red-500 via-rose-500 to-orange-400", connected: Boolean(youtubeAccount), handle: youtubeAccount?.account_name || "Ready to connect", avatarUrl: youtubeAccount?.account_avatar_url, lastSync: youtubeAccount ? "Synced 9 min ago" : "Not connected", health: youtubeAccount ? "good" : "offline" },
    { id: "threads", name: "Threads", shortName: "TH", color: "#111827", accent: "from-zinc-900 via-zinc-700 to-zinc-500", connected: Boolean(threadsAccount), handle: threadsAccount?.account_name ? `@${threadsAccount.account_name.replace(/^@/, "")}` : "Ready to connect", avatarUrl: threadsAccount?.account_avatar_url, lastSync: threadsAccount ? "Synced just now" : "Not connected", health: threadsAccount ? "good" : "offline" },
    { id: "bluesky", name: "Bluesky", shortName: "BS", color: "#1185FE", accent: "from-sky-400 via-blue-500 to-cyan-300", connected: Boolean(blueskyAccount), handle: blueskyAccount?.metadata?.handle ? `@${(blueskyAccount.metadata.handle as string).replace(/^@/, "")}` : "Ready to connect", avatarUrl: blueskyAccount?.account_avatar_url, lastSync: blueskyAccount ? "Synced just now" : "Not connected", health: blueskyAccount ? "good" : "offline" },
    { id: "pinterest", name: "Pinterest", shortName: "PI", color: "#E60023", accent: "from-red-600 via-rose-500 to-pink-400", connected: Boolean(pinterestAccount), handle: pinterestAccount?.account_name || "Ready to connect", avatarUrl: pinterestAccount?.account_avatar_url, lastSync: pinterestAccount ? "Synced just now" : "Not connected", health: pinterestAccount ? "good" : "offline" },
    { id: "discord", name: "Discord", shortName: "DC", color: "#5865F2", accent: "from-indigo-500 via-purple-500 to-pink-500", connected: Boolean(discordAccount), handle: discordAccount?.account_name || "Ready to connect", avatarUrl: discordAccount?.account_avatar_url, lastSync: discordAccount ? "Synced just now" : "Not connected", health: discordAccount ? "excellent" : "offline" },
    { id: "telegram", name: "Telegram", shortName: "TG", color: "#26A5E4", accent: "from-blue-400 via-sky-500 to-indigo-400", connected: Boolean(telegramAccount), handle: telegramAccount?.account_name || "Ready to connect", avatarUrl: telegramAccount?.account_avatar_url, lastSync: telegramAccount ? "Synced just now" : "Not connected", health: telegramAccount ? "excellent" : "offline" },
  ], [facebookAccount, instagramAccount, youtubeAccount, threadsAccount, blueskyAccount, pinterestAccount, linkedinAccount, discordAccount, telegramAccount]);

  const togglePlatform = (id: string) => {
    const platformCfg = PLATFORM_CONFIG.find((c) => c.id === id);
    if (platformCfg && !platformCfg.available) return;
    setSelectedPlatforms((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  };

  const selectedConnectedPlatforms = selectedPlatforms.filter((id) => platforms.some((p) => p.id === id && p.connected));
  const selectedPlatformDetails = platforms.filter((p) => selectedPlatforms.includes(p.id));
  const disconnectedSelectedPlatforms = selectedPlatformDetails.filter((p) => !p.connected);
  const selectedPlatformNames = selectedPlatformDetails.map((p) => p.name).join(", ") || "No platforms";
  const selectedPlatformHas = (id: PlatformKey) => selectedPlatforms.includes(id);
  const selectedMediaFirstPlatforms = selectedPlatformDetails.filter((p) => ["youtube", "instagram", "pinterest"].includes(p.id));
  const needsTitle = selectedPlatformHas("youtube");
  const needsHostedMedia = selectedPlatforms.some((id) => ["instagram", "facebook", "threads", "pinterest"].includes(id));
  const needsLink = selectedPlatformHas("facebook") || selectedPlatformHas("pinterest") || selectedPlatformHas("linkedin");
  const needsVideo = selectedPlatformHas("youtube");
  const attachmentKind = attachment?.type.startsWith("video/") ? "video" : imageAttachments.length > 0 ? "image" : attachment ? "file" : null;
  const youtubeSelectedWithoutVideo = selectedPlatformHas("youtube") && attachmentKind !== "video";
  const youtubeSelectedWithImage = selectedPlatformHas("youtube") && attachmentKind === "image";
  const otherPlatformsSelected = selectedPlatforms.filter((id) => id !== "youtube").length > 0;
  const mediaUrlValue = mediaUrl.trim();
  const isYouTubeUrl = Boolean(mediaUrlValue.match(/(youtube\.com|youtu\.be|youtube-nocookie\.com)/i));
  const isWebSearchUrl = Boolean(mediaUrlValue.match(/(search\.yahoo\.com|google\.com\/search|bing\.com\/images|pixlr\.com\/|pinterest\.com\/pin|instagram\.com\/p)/i));
  const mediaUrlIsVideo = Boolean(mediaUrlValue.match(/\.(mp4|mov|webm|avi|m4v)(\?|$)/i));
  const mediaUrlIsImage = Boolean(mediaUrlValue.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i));
  const mediaUrlLooksLikeMedia = Boolean(!isYouTubeUrl && !isWebSearchUrl && mediaUrlValue && (mediaUrlIsVideo || mediaUrlIsImage || mediaUrlValue.includes("/storage/v1/object/public/")));
  const isInvalidMediaPageUrl = Boolean(mediaUrlValue && (isYouTubeUrl || isWebSearchUrl || (!mediaUrlIsVideo && !mediaUrlIsImage && !mediaUrlValue.includes("/storage/v1/object/public/"))));

  const urlParseResult = useMemo(() => {
    if (!mediaUrl.trim()) return { validUrls: [], faultyUrls: [], errors: [], isConcatenated: false };
    
    // Split concatenated URLs (e.g. .jpghttps:// or .jpeghttps://)
    const rawSplits = mediaUrl
      .replace(/(https?:\/\/)/gi, "\n$1")
      .split(/[\n,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const validUrls: string[] = [];
    const faultyUrls: string[] = [];
    const errors: string[] = [];

    const isConcatenated = rawSplits.length > 1 && !mediaUrl.includes("\n");

    for (const raw of rawSplits) {
      try {
        const url = new URL(raw);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          faultyUrls.push(raw);
          errors.push(`"${raw.slice(0, 30)}..." is not a valid http/https URL.`);
          continue;
        }
        if (url.hostname.includes("youtube.com") || url.hostname.includes("youtu.be")) {
          faultyUrls.push(raw);
          errors.push("YouTube links cannot be published as direct media files.");
          continue;
        }
        if (url.hostname.includes("search.yahoo") || url.hostname.includes("google.com/search") || url.hostname.includes("bing.com/images")) {
          faultyUrls.push(raw);
          errors.push("Web search page links are not direct media files.");
          continue;
        }
        validUrls.push(raw);
      } catch {
        faultyUrls.push(raw);
        errors.push("Malformed URL format detected.");
      }
    }

    return { validUrls, faultyUrls, errors, isConcatenated };
  }, [mediaUrl]);

  const handleAutoFixUrls = () => {
    if (urlParseResult.validUrls.length > 0) {
      const cleanText = urlParseResult.validUrls.join("\n");
      setMediaUrl(cleanText);
      if (urlParseResult.validUrls.length > 1) {
        setImageAttachmentPreviews(urlParseResult.validUrls);
      }
    }
  };
  const hasMinChars = (caption.trim().length + postTitle.trim().length) >= 10;
  const platformGuidance = selectedPlatformDetails.length
    ? selectedPlatformDetails.map((p) => {
        if (p.id === "youtube") return "YouTube supports video uploads. Text and image posts must be created directly in YouTube Studio.";
        if (p.id === "bluesky") return "Bluesky supports text, images, and processed video uploads.";
        if (p.id === "linkedin") return "LinkedIn supports text, images, video, and link/article posts.";
        if (p.id === "instagram") return "Instagram needs a public image or video URL.";
        if (p.id === "threads") return "Threads can publish text, or media from a public URL.";
        if (p.id === "pinterest") return "Pinterest needs a public image URL and board metadata.";
        if (p.id === "facebook") return "Facebook can publish text, links, or a public image URL.";
        return `${p.name} will use the shared post text.`;
      })
    : ["Choose one or more connected platforms to adapt this form."];
  const hasDraftContent = Boolean(postTitle.trim() || caption.trim() || mediaUrl.trim() || attachment || imageAttachments.length > 0);

  const clearDraft = () => {
    setCaption(""); setPostTitle(""); setMood(""); setTags("");
    setLinkUrl(""); setLocation(""); setMediaUrl("");
    setAttachment(null); setAttachmentPreview(null);
    setImageAttachments([]); setImageAttachmentPreviews([]);
    setPublishResults([]); setPublishError(null);
  };



  // Uploads every attached image (plus a video/file attachment, if any) and
  // returns ALL of their durable URLs — used anywhere multiple images need
  // to be preserved (saving drafts, scheduling).
  const getDurableMediaUrls = async (): Promise<string[]> => {
    if (mediaUrl.trim()) return [mediaUrl.trim()];
    const urls: string[] = [];
    if (imageAttachments.length > 0) {
      const uploaded = await Promise.all(imageAttachments.map((file) => uploadFileToMediaLibrary(file)));
      urls.push(...uploaded.filter(Boolean));
    } else if (attachment && (attachment.type.startsWith("image/") || attachment.type.startsWith("video/"))) {
      const url = await uploadFileToMediaLibrary(attachment);
      if (url) urls.push(url);
    }
    if (urls.length === 0 && imageAttachmentPreviews.length > 0) {
      return imageAttachmentPreviews.filter((url) => url.startsWith("http"));
    }
    return urls;
  };

  const buildComposedCaption = () => {
    const tagText = tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ");
    return [caption.trim(), mood.trim(), tagText, location.trim() ? `Location: ${location.trim()}` : ""].filter(Boolean).join("\n\n");
  };

  // ── Save Draft ─────────────────────────────────────────────
  const saveDraftToPersonal = async () => {
    setPublishError(null);
    setDraftSaving(true);
    try {
      const durableMediaUrls = await getDurableMediaUrls();
      const composedCaption = buildComposedCaption();
      const body = JSON.stringify({
        title: postTitle.trim() || "Untitled Draft",
        description: composedCaption || caption.trim(),
        media_urls: durableMediaUrls,
        platforms: selectedPlatforms,
      });

      // Editing an existing personal draft (arrived via Drafts > Edit)
      // updates that draft in place — it must never create a duplicate.
      const res = personalDraftId
        ? await fetch(`/api/drafts/${personalDraftId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body })
        : await fetch("/api/drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Save failed");
      if (durableMediaUrls[0] && !mediaUrl.trim()) setMediaUrl(durableMediaUrls[0]);
      setDraftSaved(true);
      window.setTimeout(() => setDraftSaved(false), 3000);
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Failed to save draft. Please try again.");
    } finally {
      setDraftSaving(false);
    }
  };

  const saveDraftToWorkspace = async () => {
    setPublishError(null);
    setDraftSaving(true);
    try {
      const durableMediaUrls = await getDurableMediaUrls();
      const composedCaption = buildComposedCaption();
      const body = JSON.stringify({
        title: postTitle.trim() || "Untitled Draft",
        description: composedCaption || caption.trim(),
        media_urls: durableMediaUrls,
        platforms: selectedPlatforms,
      });

      // Editing an existing workspace draft (arrived via Edit / Edit Post)
      // updates that draft in place — it must never create a duplicate.
      const res = workspaceDraftId
        ? await fetch(`/api/workspace/drafts/${workspaceDraftId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body })
        : await fetch("/api/workspace/drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Save to workspace failed");
      if (durableMediaUrls[0] && !mediaUrl.trim()) setMediaUrl(durableMediaUrls[0]);
      setDraftSaved(true);

      // Either editing an existing draft, or just created a brand-new one
      // from the Team Compose tab — either way, land on its detail page
      // where Submit / Schedule / Publish actually happen.
      const targetId = workspaceDraftId || payload?.draft?.id;
      if (targetId) {
        router.push(`/drafts/workspace/${targetId}`);
      } else {
        window.setTimeout(() => setDraftSaved(false), 3000);
      }
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Failed to save to workspace. Please try again.");
    } finally {
      setDraftSaving(false);
    }
  };

  const saveDraft = async () => {
    if (!hasDraftContent) {
      setPublishError("Add a title, text, a media URL, or an attachment before saving a draft.");
      return;
    }
    if (isWorkspaceMode) {
      await saveDraftToWorkspace();
    } else {
      // Compose is the solo user's personal space — Team has its own
      // Compose tab for workspace drafts, so there's no "where do you
      // want to save this?" prompt here anymore.
      await saveDraftToPersonal();
    }
  };

  const getLocalDateString = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const openScheduleModal = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    setScheduleDate(getLocalDateString(now));
    setScheduleTime(now.toTimeString().slice(0, 5));
    setScheduleModal(true);
  };

  const confirmSchedule = async () => {
    if (!scheduleDate || !scheduleTime) return;
    if (!hasDraftContent) {
      setPublishError("Add a title, text, a media URL, or an attachment before scheduling.");
      setScheduleModal(false);
      return;
    }
    setPublishError(null);
    setScheduleSaving(true);
    try {
      const durableMediaUrls = await getDurableMediaUrls();
      const durableMediaUrl = durableMediaUrls[0] || "";
      const composedCaption = buildComposedCaption();
      const scheduled_time = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();

      let linkedin_media_urn: string | null = null;
      const isLinkedInSelected = selectedConnectedPlatforms.includes("linkedin");
      const isVideoMedia = attachment?.type.startsWith("video/") || Boolean(durableMediaUrl && /\.(mp4|mov|webm|avi)(\?|$)/i.test(durableMediaUrl));

      if (isLinkedInSelected && isVideoMedia && durableMediaUrl) {
        const preUploadForm = new FormData();
        preUploadForm.set("mediaUrl", durableMediaUrl);
        preUploadForm.set("mediaType", "video");
        const preUploadRes = await fetch("/api/media/preupload-linkedin", { method: "POST", body: preUploadForm });
        const preUploadData = await preUploadRes.json().catch(() => ({}));
        if (preUploadRes.ok && preUploadData.urn) {
          linkedin_media_urn = preUploadData.urn;
        } else {
          throw new Error(preUploadData.error || "LinkedIn video pre-upload failed. Please try again.");
        }
      }

      let youtube_video_id: string | null = null;
      const isYouTubeSelected = selectedConnectedPlatforms.includes("youtube");
      if (isYouTubeSelected && isVideoMedia && durableMediaUrl) {
        const ytForm = new FormData();
        ytForm.set("mediaUrl", durableMediaUrl);
        ytForm.set("title", postTitle.trim() || "Untitled Video");
        ytForm.set("description", composedCaption || caption.trim());
        const ytRes = await fetch("/api/media/preupload-youtube", { method: "POST", body: ytForm });
        const ytData = await ytRes.json().catch(() => ({}));
        if (ytRes.ok && ytData.videoId) {
          youtube_video_id = ytData.videoId;
        } else {
          throw new Error(ytData.error || "YouTube video pre-upload failed. Please try again.");
        }
      }

      const res = await fetch("/api/scheduled-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: postTitle.trim() || "Untitled Post",
          description: composedCaption || caption.trim(),
          media_urls: durableMediaUrls,
          platforms: selectedConnectedPlatforms,
          scheduled_time,
          linkedin_media_urn,
          youtube_video_id,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Schedule failed");

      setScheduleModal(false);
      setScheduleSuccess(true);
      if (durableMediaUrl && !mediaUrl.trim()) setMediaUrl(durableMediaUrl);
      clearDraft();
      window.setTimeout(() => setScheduleSuccess(false), 4000);
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Failed to schedule post. Please try again.");
      setScheduleModal(false);
    } finally {
      setScheduleSaving(false);
    }
  };

  // Sets the single video/document attachment (unchanged single-attachment
  // behavior — platforms only accept one video per post).
  const handleAttachmentChange = (file: File | null) => {
    if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
    if (file) {
      const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm|avi|m4v)(\?|$)/i.test(file.name);
      if (isVideo && file.size > 45 * 1024 * 1024) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        setPublishError(`Video "${file.name}" is ${sizeMB} MB which exceeds the 45 MB limit. Please compress your video before uploading.`);
        setAttachment(null);
        setAttachmentPreview(null);
        return;
      }
    }
    setAttachment(file);
    setAttachmentPreview(file ? URL.createObjectURL(file) : null);
    if (file) {
      if (file.type.startsWith("video/")) setActiveTab("video");
      else if (file.type.startsWith("image/")) setActiveTab("image");
      void uploadFileToMediaLibrary(file);
    }
  };



  const removeImageAttachment = (index: number) => {
    setImageAttachments((prev) => prev.filter((_, i) => i !== index));
    setImageAttachmentPreviews((prev) => {
      const url = prev[index];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const clearImageAttachments = () => {
    imageAttachmentPreviews.forEach((url) => URL.revokeObjectURL(url));
    setImageAttachments([]);
    setImageAttachmentPreviews([]);
  };

  // Routes a batch of files picked from the file input: images are
  // appended to the multi-image gallery, the first non-image file (video
  // or document) becomes the single attachment.
  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const images = files.filter((f) => f.type.startsWith("image/"));
    const nonImage = files.find((f) => !f.type.startsWith("image/"));
    if (images.length > 0) addImageAttachments(images);
    else if (nonImage) handleAttachmentChange(nonImage);
  };

  const openLibraryPicker = async () => {
    setLibraryPickerOpen(true);
    setLibraryError(null);
    setLibraryLoading(true);
    try {
      const res = await fetch("/api/media-library");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load library");
      setLibraryItems(data.items || []);
    } catch (e) {
      setLibraryError(e instanceof Error ? e.message : "Failed to load library");
    } finally {
      setLibraryLoading(false);
    }
  };

  const attachFromLibrary = (item: MediaLibraryItem) => {
    setLibraryAttachingId(item.id);
    setLibraryError(null);
    try {
      // Direct reuse of existing Supabase public URL (0 re-uploads, 0 duplicate storage!)
      setMediaUrl(item.file_url);

      if (item.file_type === "video") {
        setAttachment(null);
        setAttachmentPreview(item.file_url);
        setActiveTab("video");
      } else {
        setAttachment(null);
        setAttachmentPreview(item.file_url);
        setImageAttachmentPreviews((prev) => [...prev, item.file_url]);
        setActiveTab("image");
      }
      setLibraryPickerOpen(false);
    } catch (e) {
      setLibraryError(e instanceof Error ? e.message : "Could not attach this file");
    } finally {
      setLibraryAttachingId(null);
    }
  };

  const libraryItemsForPicker = needsVideo ? libraryItems.filter((item) => item.file_type === "video") : libraryItems;

  const publishPost = async () => {
    setPublishError(null);
    setPublishing(true);
    setPublishError(null);
    setPublishResults([]);

    try {
      let resolvedMediaUrl = mediaUrl.trim();

      if (resolvedMediaUrl) {
        if (isYouTubeUrl) {
          throw new Error("YouTube video links cannot be published as direct media due to YouTube Terms & copyright restrictions. Please attach your video file directly using 'Attach media' or upload it to your Library.");
        }
        if (isWebSearchUrl || isInvalidMediaPageUrl) {
          throw new Error("The entered Public Media URL is a web page link, not a direct image/video file (.jpg, .png, .mp4). Please enter a direct image/video URL or attach a file directly.");
        }
      }

      const supabase = createBrowserClient();

      // Direct browser-to-Supabase Storage CDN upload for video/image attachments.
      // This completely bypasses Vercel's 4.5MB request body limit and avoids HTTP 413 error!
      const userId = user?.id || user?.email || "anonymous";
      if (attachment) {
        const fileExt = attachment.name.split(".").pop() || "bin";
        const storagePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const { data, error } = await supabase.storage.from("media-library").upload(storagePath, attachment, {
          cacheControl: "3600",
          upsert: true,
        });
        if (!error && data?.path) {
          const publicUrlRes = supabase.storage.from("media-library").getPublicUrl(data.path);
          resolvedMediaUrl = publicUrlRes.data.publicUrl;
        }
      }

      if (imageAttachments.length > 0 && !resolvedMediaUrl) {
        const uploadedUrls = await Promise.all(
          imageAttachments.map(async (img) => {
            const fileExt = img.name.split(".").pop() || "jpg";
            const storagePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
            const { data, error } = await supabase.storage.from("media-library").upload(storagePath, img, {
              cacheControl: "3600",
              upsert: true,
            });
            if (!error && data?.path) {
              return supabase.storage.from("media-library").getPublicUrl(data.path).data.publicUrl;
            }
            return "";
          })
        );
        const validUrls = uploadedUrls.filter(Boolean);
        if (validUrls.length > 0) {
          resolvedMediaUrl = validUrls[0];
        }
      }

      const formData = new FormData();
      const tagText = tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ");
      const composedCaption = [caption.trim(), mood.trim(), tagText, location.trim() ? `Location: ${location.trim()}` : ""].filter(Boolean).join("\n\n");
      formData.set("caption", composedCaption);
      formData.set("title", postTitle.trim());
      formData.set("mediaUrl", resolvedMediaUrl);
      formData.set("linkUrl", linkUrl.trim());
      const isVideoFile = activeTab === "video" || Boolean(attachment?.type.startsWith("video/")) || Boolean(resolvedMediaUrl.match(/\.(mp4|mov|webm|avi|m4v)(\?|$)/i));
      formData.set("mediaType", isVideoFile ? "video" : "image");
      formData.set("platforms", selectedPlatforms.join(","));

      // Include raw files as fallback only if < 3MB to stay under Vercel payload limits
      const primaryAttachment = attachment || imageAttachments[0] || null;
      if (primaryAttachment && primaryAttachment.size < 3 * 1024 * 1024) {
        formData.set("attachment", primaryAttachment);
      }

      const response = await fetch("/api/posts/publish", { method: "POST", body: formData });
      const responseText = await response.text();
      let data: { error?: string; results?: PublishResult[]; published?: number } = {};
      try {
        data = JSON.parse(responseText);
      } catch {
        if (!response.ok) {
          throw new Error(responseText.slice(0, 200) || `Server error (${response.status})`);
        }
      }

      if (!response.ok) throw new Error(data.error || "Publishing failed.");
      setPublishResults(data.results || []);
      if (data.published && data.published > 0) {
        window.localStorage.removeItem("postelligence-draft");
      }
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Publishing failed.");
    } finally {
      setPublishing(false);
    }
  };

  // NOTE: Schedule/Publish for a workspace draft used to be triggered here
  // via a `?action=schedule|publish` redirect from the Drafts page. That
  // redirect no longer happens — Schedule/Publish now open modals directly
  // on the Drafts page (see WorkspaceDraftDetailClient) and publish through
  // the workspace's own connected accounts, not whichever member ran
  // Compose. The Schedule/Publish buttons here are hidden whenever
  // workspaceDraftId is set (see the button row below), so this Compose
  // page is edit-only for workspace drafts.

  const connectBluesky = async () => {
    setBlueskyLoading(true);
    setBlueskyError(null);
    try {
      const response = await fetch("/api/integrations/bluesky/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          composeTarget === "workspace" && workspaceId
            ? { handle: blueskyHandle, appPassword: blueskyPassword, workspaceId }
            : { handle: blueskyHandle, appPassword: blueskyPassword }
        ),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Connection failed");
      setBlueskyModal(false);
      window.location.href = composeTarget === "workspace" ? "/team?bluesky=connected" : "/create?bluesky=connected";
    } catch (err) {
      setBlueskyError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setBlueskyLoading(false);
    }
  };

  return (
    <>
      <motion.section variants={fadeUp} initial="hidden" animate="visible">
        <div className="mb-6">
          <h1 className="text-2xl font-black tracking-[-0.03em] text-[#1f2528]">Create post</h1>
          <p className="mt-1 text-sm text-slate-500">Compose and publish to your connected platforms</p>
        </div>

        <div className="mx-auto max-w-6xl">
          <div className="mb-4 rounded-lg border border-[#1f2528]/10 bg-white p-4 shadow-[0_8px_32px_rgba(31,37,40,0.08)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Channels first</p>
                <p className="mt-1 text-sm font-bold text-[#1f2528]">{selectedPlatformNames}</p>
              </div>
              <Badge className="border-[#2f7867]/20 bg-[#eaf7ef] text-[#2f7867]">
                {selectedConnectedPlatforms.length} of {platforms.filter((p) => p.connected).length} connected ready
              </Badge>
            </div>
            <div className="flex gap-3 pt-2.5 pb-3.5 px-1.5 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-100">
              {platforms.map((platform) => {
                const selected = selectedPlatforms.includes(platform.id);
                const platformCfg = PLATFORM_CONFIG.find((c) => c.id === platform.id);
                const isAvailable = !platformCfg || platformCfg.available;
                const isThreads = platform.id === "threads";
                const isYouTube = platform.id === "youtube";
                return (
                  <button key={platform.id} onClick={() => togglePlatform(platform.id)} disabled={!isAvailable}
                    title={!isAvailable ? "This integration is coming soon." : platform.connected ? platform.handle : "Connect this account before publishing"}
                    className={cn(
                      "flex min-w-[160px] shrink-0 items-center gap-3.5 rounded-xl border px-4 py-3 text-left transition-all duration-200 shadow-sm cursor-pointer",
                      selected && isThreads
                        ? "bg-white text-slate-900 border-slate-900"
                        : selected && isYouTube
                        ? "bg-white text-slate-900 border-[#FF0033]"
                        : selected
                        ? "bg-white text-slate-900"
                        : "bg-white hover:bg-[#f2f4ef] text-slate-800",
                      (!platform.connected || !isAvailable) && "opacity-60",
                      !isAvailable && "cursor-not-allowed hover:bg-white",
                      !selected && "border-slate-200/80"
                    )}
                    style={
                      selected && isAvailable && !isThreads
                        ? { borderColor: `${platform.color}`, backgroundColor: `${platform.color}0d`, transform: "scale(1.02)", boxShadow: `0 0 16px ${platform.color}45, 0 4px 12px ${platform.color}20` }
                        : selected && isThreads
                        ? { borderColor: "#000000", backgroundColor: "#0000000d", transform: "scale(1.02)", boxShadow: "0 0 16px rgba(0,0,0,0.35), 0 4px 14px rgba(0,0,0,0.2)" }
                        : undefined
                    }>
                    <span
                      className={cn(
                        "grid h-9.5 w-9.5 shrink-0 place-items-center rounded-xl border shadow-sm transition-transform duration-200",
                        selected && isThreads ? "bg-slate-950 border-slate-950 text-white" : "border-slate-100 bg-white"
                      )}
                      style={{ color: selected && isThreads ? "#ffffff" : platform.color }}
                    >
                      <PlatformLogo id={platform.id} className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-black tracking-tight leading-snug text-slate-900">{platform.name}</span>
                      <span className={cn("block truncate text-[10px] font-black mt-0.5", selected && isThreads ? "text-slate-900" : !isAvailable ? "text-amber-500" : platform.connected ? "text-slate-900" : "text-rose-500")}>
                        {!isAvailable ? "Coming soon" : platform.connected ? platform.handle : "Not connected"}
                      </span>
                    </span>
                    {selected && isAvailable && <Check className="h-4.5 w-4.5 shrink-0" style={{ color: isThreads ? "#000000" : platform.color }} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="rounded-lg border border-[#1f2528]/10 bg-white p-5 shadow-[0_8px_32px_rgba(31,37,40,0.08)]">
              <div className="mb-5 flex items-center gap-3 border-b border-[#1f2528]/8 pb-5">
                <UserAvatar name={displayName} src={user.user_metadata?.avatar_url} className="h-10 w-10 text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#1f2528]">{displayName}</p>
                  <p className="text-xs text-slate-400">{selectedMediaFirstPlatforms.length ? "Media-ready composer" : "Text-first composer"}</p>
                </div>
              </div>

              {needsTitle && (
                <label className="mb-3 block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{selectedPlatformHas("youtube") ? "Video title" : "Post title"}</span>
                  <input className="w-full rounded-lg border border-[#1f2528]/12 bg-[#f9faf7] px-4 py-3 text-sm font-bold text-[#1f2528] outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-[#2f7867]/50 focus:bg-white"
                    placeholder={selectedPlatformHas("youtube") ? "Title shown on YouTube" : "Title for LinkedIn media or article"} value={postTitle} onChange={(e) => setPostTitle(e.target.value)} />
                  {/* Per-platform title counters */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {([
                      selectedPlatformHas("youtube")   && { id: "youtube",   label: "YT",  color: "#FF0033", limit: 100 },
                      selectedPlatformHas("pinterest") && { id: "pinterest", label: "PI",  color: "#E60023", limit: 100 },
                      selectedPlatformHas("reddit")    && { id: "reddit",    label: "RD",  color: "#FF4500", limit: 300 },
                    ] as const).filter(isPresent).map((p) => {
                      const remaining = p.limit - postTitle.length;
                      const pct = postTitle.length / p.limit;
                      const urgent = remaining < 0;
                      const warn   = !urgent && pct >= 0.85;
                      return (
                        <span key={p.id}
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black tracking-wide"
                          style={{
                            borderColor: urgent ? "#ef4444" : warn ? "#f59e0b" : `${p.color}55`,
                            color:       urgent ? "#ef4444" : warn ? "#f59e0b" : p.color,
                            backgroundColor: urgent ? "#fef2f2" : warn ? "#fffbeb" : `${p.color}10`,
                          }}>
                          <PlatformLogo id={p.id} className="h-2.5 w-2.5" />
                          {urgent ? `−${Math.abs(remaining)}` : `${postTitle.length}/${p.limit}`}
                        </span>
                      );
                    })}
                    {postTitle.length > 0 && (
                      <span className="ml-auto text-[10px] font-bold text-slate-400">{postTitle.length} chars</span>
                    )}
                  </div>
                </label>
              )}

              <div className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Post text</span>
                <div className="relative">
                  <textarea className="min-h-44 w-full resize-none rounded-lg border border-[#1f2528]/12 bg-[#f9faf7] p-4 pb-12 text-sm leading-6 text-[#1f2528] outline-none transition placeholder:text-slate-400 focus:border-[#2f7867]/50 focus:bg-white"
                    placeholder={`What's on your mind, ${displayName.split(" ")[0]}?`} value={caption} onChange={(e) => setCaption(e.target.value)} />

                  {/* Action Icon Buttons: Visible only when user has written at least 10 characters */}
                  <AnimatePresence>
                    {hasMinChars && (
                      <>
                        {/* Left-Bottom Actions: Add Emojis & Translate */}
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8, y: 4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.8, y: 4 }}
                          className="absolute bottom-3 left-3 flex items-center gap-2 z-20"
                        >
                          {/* Add Emojis Button */}
                          <button
                            type="button"
                            onClick={() => void handleAddEmojisToText()}
                            disabled={aiLoading || !caption.trim()}
                            className="flex h-9 items-center gap-1.5 rounded-xl border border-amber-300/80 bg-amber-50/90 px-3 text-xs font-bold text-amber-900 shadow-sm hover:bg-amber-100 transition-all cursor-pointer disabled:opacity-40"
                            title="Inserts relevant emojis into text without changing any words"
                          >
                            <Smile className="h-4 w-4 text-amber-600 shrink-0" />
                            <span>Add Emojis</span>
                          </button>

                          {/* Globe / Translate Button */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setTranslateOpen((prev) => !prev)}
                              className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-xl border transition-all cursor-pointer shadow-sm",
                                translateOpen ? "bg-[#1f2528] text-white border-[#1f2528]" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-[#2f7867]"
                              )}
                              title="Translate post"
                            >
                              {translating ? <Loader2 className="h-4 w-4 animate-spin text-[#2f7867]" /> : <Globe className="h-4 w-4" />}
                            </button>

                            {/* Quick Translate Menu */}
                            {translateOpen && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                className="absolute left-0 bottom-full mb-2 z-40 w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
                              >
                                <p className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Translate To</p>
                                <div className="space-y-0.5">
                                  {["Spanish", "French", "German", "Hindi", "Japanese", "Italian", "Portuguese", "English"].map((lang) => (
                                    <button
                                      key={lang}
                                      type="button"
                                      onClick={() => void handleTranslateText(lang)}
                                      disabled={translating}
                                      className="w-full rounded-xl px-2.5 py-1.5 text-left text-xs font-bold text-slate-700 hover:bg-[#2f7867]/10 hover:text-[#2f7867] transition-colors flex items-center justify-between cursor-pointer"
                                    >
                                      <span>{lang}</span>
                                      <Globe className="h-3 w-3 opacity-40" />
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </div>
                        </motion.div>

                        {/* Right-Bottom Action: AI Assistant Sparkles Button */}
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8, y: 4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.8, y: 4 }}
                          className="absolute bottom-3 right-3 z-20"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setAiPromptTopic(postTitle || caption.slice(0, 100));
                              setAiModalOpen((prev) => !prev);
                            }}
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-xl border transition-all cursor-pointer shadow-md",
                              aiModalOpen ? "bg-[#2f7867] text-white border-[#2f7867] scale-105" : "bg-[#2f7867] text-white border-[#2f7867] hover:scale-110"
                            )}
                            title="AI Writing Assistant"
                          >
                            <Sparkles className="h-4 w-4" />
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>

                  {/* Inline AI Assist Popover Card */}
                  <AnimatePresence>
                    {aiModalOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        className="absolute right-0 top-full mt-2 z-30 w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xl space-y-3.5"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6.5 w-6.5 items-center justify-center rounded-lg bg-[#2f7867]/10 text-[#2f7867]">
                              <Sparkles className="h-4 w-4" />
                            </span>
                            <span className="text-xs font-black text-[#1f2528]">AI Assistant & Copywriting</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAiModalOpen(false)}
                            className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Goal presets */}
                        <div>
                          <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Action Presets</span>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { id: "caption", label: "✍️ Caption" },
                              { id: "rewrite", label: "⚡ Rewrite" },
                              { id: "hooks", label: "🎣 Hooks" },
                              { id: "hashtags", label: "#️⃣ Hashtags" },
                              { id: "cta", label: "🎯 CTA" },
                            ].map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setAiMode(m.id as "caption" | "hooks" | "hashtags" | "cta" | "rewrite")}
                                className={cn(
                                  "rounded-xl border px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer",
                                  aiMode === m.id
                                    ? "border-[#2f7867] bg-[#2f7867]/10 text-[#2f7867]"
                                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                )}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Quick 1-Click Emoji Selector Bar */}
                        <div>
                          <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Quick Insert Emoji</span>
                          <div className="flex flex-wrap gap-1">
                            {["✨", "🚀", "🔥", "💡", "🎯", "💬", "📈", "🥳", "🙌", "❤️"].map((em) => (
                              <button
                                key={em}
                                type="button"
                                onClick={() => insertEmoji(em)}
                                className="h-7 w-7 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:scale-110 transition-transform text-xs flex items-center justify-center cursor-pointer"
                              >
                                {em}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Modern Custom Tone Selector */}
                        <div className="border-t border-slate-100 pt-2.5">
                          <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Tone of Voice</span>
                          <div className="flex flex-wrap gap-1.5">
                            {["Authentic", "Professional", "Casual", "Punchy", "Witty"].map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setAiTone(t)}
                                className={cn(
                                  "rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer",
                                  aiTone === t
                                    ? "border-[#1f2528] bg-[#1f2528] text-white"
                                    : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                                )}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Topic / Focus Input */}
                        <div>
                          <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Custom Prompt / Topic</span>
                          <input
                            type="text"
                            value={aiPromptTopic}
                            onChange={(e) => setAiPromptTopic(e.target.value)}
                            placeholder="Key points or topic..."
                            className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#1f2528] outline-none focus:border-[#2f7867]"
                          />
                        </div>

                        {aiError && <p className="rounded-lg bg-rose-50 p-2 text-xs font-bold text-rose-600">{aiError}</p>}

                        {aiResult && (
                          <div className="rounded-xl border border-[#2f7867]/20 bg-[#f4f9f7] p-2.5">
                            <p className="mb-1 text-[9px] font-extrabold uppercase tracking-wider text-[#2f7867]">AI Suggestion</p>
                            <p className="max-h-28 overflow-y-auto text-xs leading-relaxed text-slate-800 whitespace-pre-wrap font-medium">{aiResult}</p>
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleGenerateAiText}
                            disabled={aiLoading}
                            className="bg-[#1f2528] text-white hover:bg-[#2b353b] text-xs py-1.5"
                          >
                            {aiLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                            {aiLoading ? "Generating..." : "Generate"}
                          </Button>
                          {aiResult && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                if (aiMode === "hashtags") {
                                  setCaption((prev) => (prev ? `${prev}\n\n${aiResult}` : aiResult));
                                } else {
                                  setCaption(aiResult);
                                }
                                setAiModalOpen(false);
                              }}
                              className="bg-[#2f7867] text-white hover:bg-[#266254] text-xs py-1.5"
                            >
                              Apply to Post
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Per-platform caption counters */}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {([
                    selectedPlatformHas("twitter")   && { id: "twitter",   label: "X",   color: "#000000", limit: 280 },
                    selectedPlatformHas("bluesky")   && { id: "bluesky",   label: "BS",  color: "#1185FE", limit: 300 },
                    selectedPlatformHas("threads")   && { id: "threads",   label: "TH",  color: "#111827", limit: 500 },
                    selectedPlatformHas("instagram") && { id: "instagram", label: "IG",  color: "#E1306C", limit: 2200 },
                    selectedPlatformHas("pinterest") && { id: "pinterest", label: "PI",  color: "#E60023", limit: 500 },
                    selectedPlatformHas("linkedin")  && { id: "linkedin",  label: "IN",  color: "#0A66C2", limit: 3000 },
                    selectedPlatformHas("youtube")   && { id: "youtube",   label: "YT",  color: "#FF0033", limit: 5000 },
                    selectedPlatformHas("facebook")  && { id: "facebook",  label: "FB",  color: "#1877F2", limit: 63206 },
                    selectedPlatformHas("reddit")    && { id: "reddit",    label: "RD",  color: "#FF4500", limit: 40000 },
                    selectedPlatformHas("discord")   && { id: "discord",   label: "DC",  color: "#5865F2", limit: 2000 },
                    selectedPlatformHas("telegram")  && { id: "telegram",  label: "TG",  color: "#26A5E4", limit: (mediaUrl.trim() || attachment || imageAttachments.length > 0) ? 1024 : 4096 },
                  ] as const).filter(isPresent).map((p) => {
                    const remaining = p.limit - caption.length;
                    const pct = caption.length / p.limit;
                    const urgent = remaining < 0;
                    const warn   = !urgent && pct >= 0.85;
                    return (
                      <span key={p.id}
                        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black tracking-wide transition-colors"
                        style={{
                          borderColor:     urgent ? "#ef4444" : warn ? "#f59e0b" : `${p.color}55`,
                          color:           urgent ? "#ef4444" : warn ? "#f59e0b" : p.color,
                          backgroundColor: urgent ? "#fef2f2" : warn ? "#fffbeb" : `${p.color}10`,
                        }}>
                        <PlatformLogo id={p.id} className="h-2.5 w-2.5" />
                        {urgent
                          ? `−${Math.abs(remaining)}`
                          : remaining <= 50
                          ? `${remaining} left`
                          : `${caption.length}/${p.limit}`}
                      </span>
                    );
                  })}
                  {selectedPlatforms.length === 0 && (
                    <span className={caption.length > 500 ? "text-rose-500 font-black text-xs" : "text-slate-400 text-xs font-bold"}>
                      {caption.length}/500
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-lg border border-[#1f2528]/10 bg-[#f9faf7] px-3 py-2.5 text-sm">
                  <Hash className="h-4 w-4 shrink-0 text-slate-400" />
                  <input className="min-w-0 flex-1 bg-transparent text-[#1f2528] outline-none placeholder:text-slate-400" placeholder="Tags, comma separated" value={tags} onChange={(e) => setTags(e.target.value)} />
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-[#1f2528]/10 bg-[#f9faf7] px-3 py-2.5 text-sm">
                  <Smile className="h-4 w-4 shrink-0 text-slate-400" />
                  <input className="min-w-0 flex-1 bg-transparent text-[#1f2528] outline-none placeholder:text-slate-400" placeholder="Tone or mood" value={mood} onChange={(e) => setMood(e.target.value)} />
                </label>
                {needsLink && (
                  <label className="flex items-center gap-2 rounded-lg border border-[#1f2528]/10 bg-[#f9faf7] px-3 py-2.5 text-sm sm:col-span-2">
                    <Link2 className="h-4 w-4 shrink-0 text-slate-400" />
                    <input className="min-w-0 flex-1 bg-transparent text-[#1f2528] outline-none placeholder:text-slate-400" placeholder="Link URL" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
                  </label>
                )}
                {(selectedPlatformHas("instagram") || selectedPlatformHas("facebook")) && (
                  <label className="flex items-center gap-2 rounded-lg border border-[#1f2528]/10 bg-[#f9faf7] px-3 py-2.5 text-sm sm:col-span-2">
                    <RadioTower className="h-4 w-4 shrink-0 text-slate-400" />
                    <input className="min-w-0 flex-1 bg-transparent text-[#1f2528] outline-none placeholder:text-slate-400" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
                  </label>
                )}
              </div>

              <div className="mt-4 rounded-lg border border-dashed border-[#1f2528]/14 bg-[#f9faf7] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <input ref={attachmentInputRef} type="file" multiple={!needsVideo} className="hidden" accept={needsVideo ? "video/*" : "image/*,video/*,.pdf,.doc,.docx,.txt"} onChange={(e) => { handleFilesSelected(e.target.files); e.target.value = ""; }} />
                  <Button variant="secondary" size="sm" onClick={() => attachmentInputRef.current?.click()}>
                    <Paperclip className="h-3.5 w-3.5" />{needsVideo ? "Attach video" : imageAttachments.length > 0 ? "Add another image" : "Attach media"}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => void openLibraryPicker()}>
                    <Library className="h-3.5 w-3.5" />Attach from Library
                  </Button>
                  <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-slate-500">
                    {attachmentKind === "video" ? <Video className="h-3.5 w-3.5" /> : attachmentKind === "image" ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                    <span className="truncate">
                      {imageAttachments.length > 1 ? `${imageAttachments.length} images attached`
                        : imageAttachments.length === 1 ? imageAttachments[0].name
                        : attachment ? attachment.name
                        : needsVideo && !otherPlatformsSelected ? "Attach a video for YouTube" : "Images, videos, or documents — you can add several images"}
                    </span>
                  </div>
                  {attachment && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleAttachmentChange(null)}><X className="h-4 w-4" /></Button>}
                  {imageAttachments.length > 0 && <Button variant="ghost" size="sm" className="h-8" onClick={clearImageAttachments}>Clear all</Button>}
                </div>

                {imageAttachments.length > 0 ? (
                  <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                    {imageAttachments.map((file, i) => {
                      const fileProgress = uploadProgressMap[file.name];
                      const isUploadingThis = fileProgress !== undefined && fileProgress < 100;
                      const isSelected = selectedImageIndices.includes(i);
                      const hasAnySelected = selectedImageIndices.length > 0;
                      return (
                        <div
                          key={`${file.name}-${i}`}
                          className={cn(
                            "group relative aspect-square overflow-hidden rounded-xl border border-[#1f2528]/10 bg-white transition-all duration-200 shadow-sm",
                            isSelected && "ring-2 ring-[#2f7867] ring-offset-2 scale-[0.98]"
                          )}
                        >
                          <img src={imageAttachmentPreviews[i]} alt="" className="h-full w-full object-cover" />

                          {/* Google Photos Style Selection Checkbox (Top-Left Corner) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedImageIndices((prev) =>
                                prev.includes(i) ? prev.filter((idx) => idx !== i) : [...prev, i]
                              );
                            }}
                            className={cn(
                              "absolute top-2 left-2 z-20 h-6 w-6 rounded-full border-2 transition-all duration-200 cursor-pointer flex items-center justify-center shadow-md",
                              isSelected
                                ? "border-white bg-[#2f7867] text-white scale-110 opacity-100"
                                : hasAnySelected
                                ? "border-slate-300 bg-white/95 text-slate-400 hover:border-[#2f7867] hover:text-[#2f7867] opacity-100"
                                : "border-white/90 bg-black/30 backdrop-blur-sm text-transparent hover:scale-110 opacity-0 group-hover:opacity-100"
                            )}
                            title={isSelected ? "Deselect image" : "Select image"}
                          >
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </button>

                          {i === 0 && (
                            <span className="absolute left-9 top-2 rounded-full bg-[#1f2528]/80 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white backdrop-blur-sm z-10">
                              Primary
                            </span>
                          )}

                          {!isUploadingThis && (
                            <button
                              type="button"
                              onClick={() => removeImageAttachment(i)}
                              className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 z-10 cursor-pointer"
                              title="Delete image"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {isUploadingThis && (
                            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/40 backdrop-blur-md p-1 text-center">
                              <div className="relative flex items-center justify-center">
                                <svg className="h-10 w-10 transform -rotate-90 filter drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]" viewBox="0 0 36 36">
                                  <path className="text-white/20" strokeWidth="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                  <path className="transition-all duration-300 ease-out" strokeDasharray={`${fileProgress}, 100`} strokeWidth="4" strokeLinecap="round" stroke="url(#uploadRingGradient)" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                </svg>
                                <span className="absolute text-[11px] font-black text-white drop-shadow-md">{fileProgress}%</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {imageAttachments.length < MAX_IMAGE_ATTACHMENTS && (
                      <button type="button" onClick={() => attachmentInputRef.current?.click()}
                        className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-[#1f2528]/20 bg-white text-slate-400 transition hover:border-[#2f7867]/40 hover:text-[#2f7867] cursor-pointer">
                        <ImageIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                ) : (attachmentPreview || mediaUrlLooksLikeMedia) && (
                  <div className="relative mt-3 overflow-hidden rounded-lg border border-[#1f2528]/10 bg-white">
                    {attachment && uploadProgressMap[attachment.name] !== undefined && uploadProgressMap[attachment.name] < 100 && (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-md p-4 text-center border border-white/10 transition-all duration-300">
                        <div className="relative flex items-center justify-center">
                          <svg className="h-16 w-16 transform -rotate-90 filter drop-shadow-[0_0_12px_rgba(16,185,129,0.4)]" viewBox="0 0 36 36">
                            <defs>
                              <linearGradient id="uploadRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#38bdf8" />
                                <stop offset="100%" stopColor="#34d399" />
                              </linearGradient>
                            </defs>
                            <path className="text-white/20" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            <path
                              className="transition-all duration-300 ease-out"
                              strokeDasharray={`${uploadProgressMap[attachment.name]}, 100`}
                              strokeWidth="3.5"
                              strokeLinecap="round"
                              stroke="url(#uploadRingGradient)"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                          </svg>
                          <span className="absolute text-base font-black text-white tracking-tight drop-shadow-md">
                            {uploadProgressMap[attachment.name]}%
                          </span>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                          <p className="text-xs font-black text-white tracking-wide drop-shadow-md">Uploading media to storage…</p>
                        </div>
                        <p className="mt-1 text-[11px] font-semibold text-slate-200/80">Publishing is paused until upload completes</p>
                      </div>
                    )}
                    {attachment?.type.startsWith("video/") ? (
                      <video src={attachmentPreview || undefined} controls className="max-h-72 w-full bg-black object-contain" />
                    ) : mediaUrlIsVideo ? (
                      <video src={mediaUrlValue} controls preload="metadata" className="max-h-72 w-full bg-black object-contain" />
                    ) : mediaUrlValue ? (
                      <img src={mediaUrlValue} alt="" className="max-h-72 w-full object-cover" />
                    ) : (
                      <div className="flex items-center gap-3 p-3 text-sm text-slate-600"><FileText className="h-5 w-5" /><span className="truncate">{attachment?.name}</span></div>
                    )}
                  </div>
                )}

                {imageAttachments.length > 1 && (
                  <p className="mt-2 text-[11px] leading-4 text-slate-400">
                    All {imageAttachments.length} images are saved with drafts and scheduled posts. Publishing right now sends the primary image; full multi-image publishing per platform is next.
                  </p>
                )}

                {youtubeSelectedWithoutVideo && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-amber-500">⚠</span>
                      <div className="text-xs leading-5 text-amber-800">
                        {youtubeSelectedWithImage ? (
                          otherPlatformsSelected ? <><strong>YouTube will be skipped</strong> — it only supports video uploads, not images. <a href="https://studio.youtube.com" target="_blank" rel="noreferrer" className="underline font-bold">Create image posts in YouTube Studio ↗</a></> :
                          <><strong>YouTube doesn&apos;t support image posts.</strong> Please attach a video instead, or <a href="https://studio.youtube.com" target="_blank" rel="noreferrer" className="underline font-bold">use YouTube Studio ↗</a></>
                        ) : (
                          otherPlatformsSelected ? <><strong>YouTube needs a video to publish.</strong> Without one, YouTube will be skipped. <a href="https://studio.youtube.com" target="_blank" rel="noreferrer" className="underline font-bold">For text posts, use YouTube Studio ↗</a></> :
                          <><strong>YouTube only supports video uploads.</strong> Attach a video to publish, or <a href="https://studio.youtube.com" target="_blank" rel="noreferrer" className="underline font-bold">use YouTube Studio ↗</a></>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {needsHostedMedia && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Public Media URLs</span>
                      <span className="text-[11px] text-slate-400 font-bold">Supports multiple URLs (paste one per line)</span>
                    </div>

                    <div className="relative">
                      <textarea
                        rows={mediaUrl.includes("\n") ? 3 : 1}
                        className="w-full resize-y rounded-xl border border-[#1f2528]/12 bg-white p-3 text-xs text-[#1f2528] outline-none transition placeholder:text-slate-400 focus:border-[#2f7867]/50"
                        placeholder="Public media URLs (direct .jpg, .png, or .mp4 links — paste multiple URLs one per line)"
                        value={mediaUrl}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMediaUrl(val);
                          const splits = val.replace(/(https?:\/\/)/gi, "\n$1").split(/[\n,\s]+/).map((s) => s.trim()).filter((s) => s.startsWith("http"));
                          if (splits.length > 1) {
                            setImageAttachmentPreviews(splits);
                          }
                        }}
                      />
                    </div>

                    {/* Faulty URL Warning & Auto-Fix Banner */}
                    {(urlParseResult.faultyUrls.length > 0 || urlParseResult.isConcatenated) && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-900 shadow-sm space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            <X className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-black text-rose-900">
                                {urlParseResult.isConcatenated
                                  ? "Concatenated / Glued URLs Detected!"
                                  : "Invalid or Faulty Media URL(s) Detected"}
                              </p>
                              <p className="mt-0.5 font-medium text-rose-700">
                                {urlParseResult.isConcatenated
                                  ? "You pasted multiple URLs stuck together without spaces or newlines (e.g. .jpeghttps://...). Click Auto-Fix to split them into clean individual URLs."
                                  : urlParseResult.errors[0] || "Some URLs in your input are malformed or unreachable."}
                              </p>
                            </div>
                          </div>
                          {urlParseResult.validUrls.length > 0 && (
                            <button
                              type="button"
                              onClick={handleAutoFixUrls}
                              className="shrink-0 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition-all cursor-pointer shadow-sm flex items-center gap-1"
                            >
                              🛠️ Auto-Fix & Split ({urlParseResult.validUrls.length})
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {isYouTubeUrl && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-800">
                        <p className="font-black text-rose-900 flex items-center gap-1.5 mb-1">
                          <X className="h-4 w-4 text-rose-600 shrink-0" />
                          YouTube URLs cannot be published as media
                        </p>
                        <p className="font-medium text-rose-700">
                          Due to YouTube Terms of Service & copyright rules, YouTube watch/video links cannot be fetched as direct media. Please attach your video file directly using <strong>&quot;Attach media&quot;</strong> or upload it to your Library.
                        </p>
                      </div>
                    )}

                    {!isYouTubeUrl && !urlParseResult.isConcatenated && isInvalidMediaPageUrl && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                        <p className="font-black text-amber-900 flex items-center gap-1.5 mb-1">
                          ⚠ Direct Media File Link Required
                        </p>
                        <p className="font-medium text-amber-700">
                          Web search pages and web page links cannot be fetched by social media APIs. Please paste a direct image URL ending in <strong>.jpg, .png, .webp, or .mp4</strong> or attach a file directly.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {uploadStatusText && (
                <div className="mt-4 flex items-center gap-3 rounded-lg border border-[#2f7867]/30 bg-[#f4f9f7] px-4 py-3 text-sm font-bold text-[#2f7867]">
                  <Loader2 className="h-4.5 w-4.5 shrink-0 animate-spin text-[#2f7867]" />
                  <span>{uploadStatusText}</span>
                </div>
              )}
              {publishError && <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">{publishError}</p>}
              {draftSaving && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#f4f8ff] px-4 py-3 text-sm font-bold text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving draft...
                </div>
              )}
              {scheduleSaving && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#f4f8ff] px-4 py-3 text-sm font-bold text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {selectedConnectedPlatforms.includes("linkedin") && (attachment?.type.startsWith("video/") || Boolean(mediaUrl.match(/\.(mp4|mov|webm|avi)(\?|$)/i)))
                    ? "Uploading video to LinkedIn… this may take 10–30 seconds"
                    : "Scheduling your post..."}
                </div>
              )}
              {draftSaved && !draftSaving && (
                <p className="mt-4 rounded-lg bg-[#eaf7ef] px-4 py-3 text-sm font-bold text-[#2f7867]">
                  ✓ Draft saved! View it in <a href="/drafts" className="underline hover:opacity-80">Drafts</a>.
                </p>
              )}
              {scheduleSuccess && !scheduleSaving && (
                <p className="mt-4 rounded-lg bg-[#eaf7ef] px-4 py-3 text-sm font-bold text-[#2f7867]">
                  ✓ Post scheduled! View it in <a href="/calendar" className="underline hover:opacity-80">Calendar</a>.
                </p>
              )}

              <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr]">
                <Button variant="secondary" disabled={draftSaving || isUploadingMedia || !hasDraftContent} onClick={() => void saveDraft()} className={isWorkspaceMode ? "sm:col-span-3" : ""}>
                  {draftSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {draftSaving ? "Saving..." : (workspaceDraftId || personalDraftId) ? "Save Changes" : "Save draft"}
                </Button>
                {/* Schedule/Publish for a Team Workspace draft happen from the
                    Workspace Drafts page (with the workspace's connected
                    accounts) — not here, so these are hidden in workspace
                    compose mode (new or existing draft). */}
                {!isWorkspaceMode && (
                  <>
                    <Button variant="secondary" disabled={scheduleSaving || isUploadingMedia || !hasDraftContent} onClick={openScheduleModal}>Schedule</Button>
                    <Button variant="primary" disabled={publishing || isUploadingMedia || !hasDraftContent || selectedPlatforms.length === 0} onClick={() => setPublishModal(true)}>
                      {publishing || isUploadingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                      {isUploadingMedia ? `Uploading (${overallUploadProgress}%)` : publishing ? "Publishing…" : "Publish"}
                    </Button>
                  </>
                )}
              </div>
              {isWorkspaceMode && (
                <p className="mt-2 text-xs text-slate-400">
                  Scheduling and publishing for workspace drafts happen from the Drafts page.
                </p>
              )}
            </div>

            <aside className="space-y-4">
              <div className="rounded-lg border border-[#1f2528]/10 bg-white p-4 shadow-[0_8px_32px_rgba(31,37,40,0.08)]">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-black text-[#1f2528]">Preview</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">One master post, adapted per platform</p>
                  </div>
                </div>

                {/* Platform tabs */}
                {selectedPlatformDetails.length > 0 && (
                  <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
                    {selectedPlatformDetails.map((p) => {
                      const active = (previewTab || selectedPlatformDetails[0]?.id) === p.id;
                      return (
                        <button key={p.id}
                          onClick={() => setPreviewTab(p.id)}
                          className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors",
                            active ? "border-[#2f7867]/40 bg-[#eaf7ef] text-[#2f7867]" : "border-[#1f2528]/10 bg-white text-slate-500 hover:bg-[#f2f4ef]")}>
                          <PlatformLogo id={p.id} className="h-3.5 w-3.5" />
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Platform-specific preview card */}
                <div className={cn("rounded-lg border border-[#1f2528]/10 p-4",
                  (previewTab || selectedPlatformDetails[0]?.id) === "discord" ? "bg-[#f2f3f5]" : "bg-[#f9faf7]")}>
                  {(() => {
                    const activePlatformId = (previewTab || selectedPlatformDetails[0]?.id) as PlatformKey | undefined;
                    const activePlatform = selectedPlatformDetails.find((p) => p.id === activePlatformId) || selectedPlatformDetails[0];
                    const hasMedia = Boolean(imageAttachmentPreviews[0] || attachmentPreview || mediaUrlLooksLikeMedia);
                    const handle = activePlatform?.connected ? activePlatform.handle : displayName;

                    const mediaNode = (aspectClass: string) => {
                      if (!hasMedia) return null;
                      return (
                        <div className={cn("relative flex items-center justify-center overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm", aspectClass)}>
                          {imageAttachmentPreviews[0] ? (
                            <>
                              <img src={imageAttachmentPreviews[0]} alt="" className="h-full w-full object-cover" />
                              {imageAttachments.length > 1 && (
                                <span className="absolute bottom-1.5 right-1.5 rounded-full bg-[#1f2528]/70 px-2 py-0.5 text-[11px] font-bold text-white">1/{imageAttachments.length}</span>
                              )}
                            </>
                          ) : attachment?.type.startsWith("video/") ? <video src={attachmentPreview || undefined} controls className="h-full w-full object-cover bg-black" />
                            : mediaUrlIsVideo ? <video src={mediaUrlValue} preload="metadata" controls className="h-full w-full object-cover bg-black" />
                            : mediaUrlValue ? <img src={mediaUrlValue} alt="" className="h-full w-full object-cover" />
                            : <div className="flex w-full items-center gap-2 p-3 text-xs text-slate-500"><FileText className="h-4 w-4 shrink-0 text-slate-400" /><span className="truncate font-medium">{attachment?.name}</span></div>}
                        </div>
                      );
                    };

                    const header = (sub: string) => (
                      <div className="mb-3 flex items-center gap-2.5">
                        {/* Avatar: real profile photo with platform logo badge, or logo fallback */}
                        <span className="relative inline-flex h-8 w-8 shrink-0">
                          {activePlatform?.avatarUrl ? (
                            <>
                              <img
                                src={activePlatform.avatarUrl}
                                alt={handle}
                                className="h-8 w-8 rounded-full object-cover ring-2 ring-white shadow-sm"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; (e.currentTarget.nextSibling as HTMLElement).style.display = "flex"; }}
                              />
                              {/* Fallback circle (hidden unless img fails) */}
                              <span
                                className="absolute inset-0 hidden items-center justify-center rounded-full shadow-sm"
                                style={{ backgroundColor: activePlatform?.color ?? "#1f2528" }}
                              >
                                <PlatformLogo id={id ?? ""} className="h-4 w-4 text-white" />
                              </span>
                              {/* Platform badge */}
                              <span
                                className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-1 ring-white"
                                style={{ backgroundColor: activePlatform?.color ?? "#1f2528" }}
                              >
                                <PlatformLogo id={id ?? ""} className="h-2 w-2 text-white" />
                              </span>
                            </>
                          ) : (
                            <span
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full shadow-sm"
                              style={{ backgroundColor: activePlatform?.color ?? "#1f2528" }}
                            >
                              <PlatformLogo id={id ?? ""} className="h-4 w-4 text-white" />
                            </span>
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[#1f2528]">{handle}</p>
                          <p className="truncate text-[10px] text-slate-400">{sub}</p>
                        </div>
                        <MoreHorizontal className="ml-auto h-4 w-4 shrink-0 text-slate-300" />
                      </div>
                    );

                    const id = activePlatform?.id;

                    // ── Threads ──────────────────────────────────────────
                    if (id === "threads") return (
                      <div>
                        {header("Now")}
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#2f3940]">{caption || <span className="text-slate-400">Your post text will appear here.</span>}</p>
                        {hasMedia && <div className="mt-3">{mediaNode("aspect-video w-full")}</div>}
                        <div className="mt-3 flex items-center gap-4">
                          <button className="flex items-center gap-1.5 text-slate-500 hover:text-rose-500 transition-colors"><Heart className="h-[18px] w-[18px]" /><span className="text-[11px] font-bold">0</span></button>
                          <button className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition-colors"><MessageCircle className="h-[18px] w-[18px]" /><span className="text-[11px] font-bold">0</span></button>
                          <button className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition-colors"><Repeat2 className="h-[18px] w-[18px]" /><span className="text-[11px] font-bold">0</span></button>
                          <button className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition-colors"><Share2 className="h-[18px] w-[18px]" /></button>
                        </div>
                      </div>
                    );

                    // ── Twitter / X ───────────────────────────────────────
                    if (id === "twitter") return (
                      <div>
                        {header("Just now")}
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#2f3940]">{caption || <span className="text-slate-400">Your post text will appear here.</span>}</p>
                        {hasMedia && <div className="mt-3">{mediaNode("aspect-video w-full")}</div>}
                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-slate-500">
                          <button className="flex items-center gap-1.5 hover:text-[#1d9bf0] transition-colors"><MessageCircle className="h-4 w-4" /><span className="text-[11px] font-bold">0</span></button>
                          <button className="flex items-center gap-1.5 hover:text-[#00ba7c] transition-colors"><Repeat2 className="h-4 w-4" /><span className="text-[11px] font-bold">0</span></button>
                          <button className="flex items-center gap-1.5 hover:text-rose-500 transition-colors"><Heart className="h-4 w-4" /><span className="text-[11px] font-bold">0</span></button>
                          <button className="flex items-center gap-1.5 hover:text-[#1d9bf0] transition-colors"><Eye className="h-4 w-4" /><span className="text-[11px] font-bold">0</span></button>
                          <button className="flex items-center gap-1.5 hover:text-[#1d9bf0] transition-colors"><Bookmark className="h-4 w-4" /></button>
                          <button className="flex items-center gap-1.5 hover:text-[#1d9bf0] transition-colors"><Share2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                    );

                    // ── Instagram ─────────────────────────────────────────
                    if (id === "instagram") return (
                      <div>
                        {header("Just now")}
                        {mediaNode("aspect-square mb-3 w-full")}
                        <div className="flex items-center gap-4 mb-2">
                          <button className="text-[#1f2528] hover:text-rose-500 transition-colors"><Heart className="h-5 w-5" /></button>
                          <button className="text-[#1f2528] hover:text-slate-500 transition-colors"><MessageCircle className="h-5 w-5" /></button>
                          <button className="text-[#1f2528] hover:text-slate-500 transition-colors"><Share2 className="h-5 w-5" /></button>
                          <button className="ml-auto text-[#1f2528] hover:text-slate-500 transition-colors"><Bookmark className="h-5 w-5" /></button>
                        </div>
                        <p className="text-[11px] font-bold text-[#1f2528] mb-1">Be the first to like this</p>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#2f3940]">
                          <span className="font-bold text-[#1f2528]">{handle}</span>{" "}
                          {caption || <span className="text-slate-400">Your caption will appear here.</span>}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">View all comments</p>
                      </div>
                    );

                    // ── Facebook ──────────────────────────────────────────
                    if (id === "facebook") return (
                      <div>
                        {header("Just now · 🌐")}
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#2f3940]">{caption || <span className="text-slate-400">Your post text will appear here.</span>}</p>
                        {hasMedia && <div className="mt-3">{mediaNode("aspect-video w-full")}</div>}
                        <div className="mt-3 border-t border-slate-100 pt-2.5">
                          <div className="flex gap-1 mb-2">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1877f2] text-[9px]">👍</span>
                            <span className="text-[11px] text-slate-500">Be the first to react</span>
                          </div>
                          <div className="flex items-center justify-around border-t border-slate-100 pt-2">
                            <button className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-[#1877f2] transition-colors"><ThumbsUp className="h-4 w-4" /> Like</button>
                            <button className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-[#1877f2] transition-colors"><MessageCircle className="h-4 w-4" /> Comment</button>
                            <button className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-[#1877f2] transition-colors"><Share2 className="h-4 w-4" /> Share</button>
                          </div>
                        </div>
                      </div>
                    );

                    // ── LinkedIn ──────────────────────────────────────────
                    if (id === "linkedin") return (
                      <div>
                        {header("You · 1st")}
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#2f3940]">{caption || <span className="text-slate-400">Your post text will appear here.</span>}</p>
                        {hasMedia && <div className="mt-3">{mediaNode("aspect-video w-full")}</div>}
                        <div className="mt-3 border-t border-slate-100 pt-2.5">
                          <div className="flex items-center justify-around">
                            <button className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-slate-500 hover:text-[#0a66c2] transition-colors"><ThumbsUp className="h-4 w-4" /> Like</button>
                            <button className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-slate-500 hover:text-[#0a66c2] transition-colors"><MessageCircle className="h-4 w-4" /> Comment</button>
                            <button className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-slate-500 hover:text-[#0a66c2] transition-colors"><Repeat2 className="h-4 w-4" /> Repost</button>
                            <button className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-slate-500 hover:text-[#0a66c2] transition-colors"><Send className="h-4 w-4" /> Send</button>
                          </div>
                        </div>
                      </div>
                    );

                    // ── YouTube ───────────────────────────────────────────
                    if (id === "youtube") return (
                      <div>
                        {mediaNode("aspect-video mb-3 w-full") ?? (
                          <div className="mb-3 flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-xs text-slate-400">
                            <Video className="mr-1.5 h-4 w-4" /> Video thumbnail
                          </div>
                        )}
                        <p className="text-sm font-black leading-snug text-[#1f2528]">{postTitle.trim() || "Your video title will appear here."}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <UserAvatar name={displayName} src={user.user_metadata?.avatar_url} className="h-6 w-6 shrink-0 text-[10px]" />
                          <p className="truncate text-[11px] font-bold text-slate-500">{handle}</p>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">0 views · Just now</p>
                        <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-500">{caption || "Your description will appear here."}</p>
                        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                          <button className="flex items-center gap-1.5 rounded-full bg-[#f2f2f2] px-3 py-1 text-[11px] font-bold text-[#0f0f0f] hover:bg-[#e0e0e0] transition-colors"><ThumbsUp className="h-3.5 w-3.5" /> 0</button>
                          <button className="flex items-center gap-1.5 rounded-full bg-[#f2f2f2] px-3 py-1 text-[11px] font-bold text-[#0f0f0f] hover:bg-[#e0e0e0] transition-colors"><Share2 className="h-3.5 w-3.5" /> Share</button>
                          <button className="ml-auto flex items-center gap-1.5 rounded-full bg-[#f2f2f2] px-3 py-1 text-[11px] font-bold text-[#0f0f0f] hover:bg-[#e0e0e0] transition-colors"><MoreHorizontal className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    );

                    // ── Bluesky ───────────────────────────────────────────
                    if (id === "bluesky") return (
                      <div>
                        {header("· Now")}
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#2f3940]">{caption || <span className="text-slate-400">Your post text will appear here.</span>}</p>
                        {hasMedia && <div className="mt-3">{mediaNode("aspect-video w-full")}</div>}
                        <div className="mt-3 flex items-center gap-5 border-t border-slate-100 pt-2.5 text-slate-500">
                          <button className="flex items-center gap-1.5 hover:text-[#0085ff] transition-colors"><MessageCircle className="h-4 w-4" /><span className="text-[11px] font-bold">0</span></button>
                          <button className="flex items-center gap-1.5 hover:text-[#00ba7c] transition-colors"><Repeat2 className="h-4 w-4" /><span className="text-[11px] font-bold">0</span></button>
                          <button className="flex items-center gap-1.5 hover:text-rose-500 transition-colors"><Heart className="h-4 w-4" /><span className="text-[11px] font-bold">0</span></button>
                          <button className="ml-auto flex items-center gap-1.5 hover:text-[#0085ff] transition-colors"><Share2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                    );

                    // ── Pinterest ─────────────────────────────────────────
                    if (id === "pinterest") return (
                      <div>
                        {mediaNode("aspect-[3/4] mb-3 w-full") ?? (
                          <div className="mb-3 flex aspect-[3/4] w-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-xs text-slate-400">
                            <ImageIcon className="mr-1.5 h-4 w-4" /> Image
                          </div>
                        )}
                        <p className="text-sm font-black leading-snug text-[#1f2528]">{postTitle.trim() || "Pin title"}</p>
                        <p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-slate-500">{caption || "Your pin description will appear here."}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <button className="flex items-center gap-1.5 rounded-full bg-[#e60023] px-4 py-1.5 text-[11px] font-bold text-white hover:bg-[#ad081b] transition-colors">Save</button>
                          <button className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition-colors"><Share2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                    );

                    // ── Reddit ────────────────────────────────────────────
                    if (id === "reddit") return (
                      <div>
                        {header("Just now · r/yoursubreddit")}
                        <p className="mb-2 text-sm font-black leading-snug text-[#1f2528]">{postTitle.trim() || "Post title"}</p>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#2f3940]">{caption || <span className="text-slate-400">Your post text will appear here.</span>}</p>
                        {hasMedia && <div className="mt-3">{mediaNode("aspect-video w-full")}</div>}
                        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2.5">
                          <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1">
                            <button className="text-slate-400 hover:text-[#ff4500] transition-colors"><ArrowBigUp className="h-4 w-4" /></button>
                            <span className="text-[11px] font-bold text-slate-600">Vote</span>
                            <button className="text-slate-400 hover:text-[#7193ff] transition-colors"><ArrowBigUp className="h-4 w-4 rotate-180" /></button>
                          </div>
                          <button className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-50 transition-colors"><MessageCircle className="h-3.5 w-3.5" /> Comment</button>
                          <button className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-50 transition-colors"><Share2 className="h-3.5 w-3.5" /> Share</button>
                        </div>
                      </div>
                    );

                    // ── Discord ───────────────────────────────────────────
                    if (id === "discord") return (
                      <div className="bg-white rounded-xl p-3 -m-4 border border-[#e3e5e8]">
                        <div className="mb-2 flex items-start gap-2.5">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5865f2] shadow-sm mt-0.5">
                            <PlatformLogo id="discord" className="h-4 w-4 text-white" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-bold text-[#060607]">{displayName}</span>
                              <span className="text-[10px] font-bold text-[#5865f2] bg-[#5865f2]/10 px-1 rounded">APP</span>
                              <span className="text-[10px] text-[#747f8d]">Today {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                            <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-[#2e3035]">{caption || <span className="text-[#747f8d]">Your message will appear here.</span>}</p>
                            {hasMedia && <div className="mt-2.5 rounded-lg overflow-hidden border border-[#e3e5e8]">{mediaNode("aspect-video w-full")}</div>}
                          </div>
                        </div>
                        <div className="ml-10 flex items-center gap-1 mt-1">
                          <button className="flex items-center gap-1 rounded-full border border-[#e3e5e8] bg-[#f2f3f5] px-2 py-0.5 text-[11px] text-[#2e3035] hover:bg-[#ebedef] transition-colors">😀 <span className="font-bold text-[#5865f2] ml-0.5">1</span></button>
                          <button className="flex items-center gap-1 rounded-full border border-[#e3e5e8] bg-white px-2 py-0.5 text-[11px] text-[#4e5058] hover:bg-[#f2f3f5] transition-colors"><Smile className="h-3 w-3" /> +</button>
                        </div>
                      </div>
                    );

                    // ── Telegram ──────────────────────────────────────────
                    if (id === "telegram") return (
                      <div>
                        <div className="rounded-2xl bg-[#effdde] p-3 max-w-[90%] mt-2 relative shadow-sm border border-[#b5e8a3]/50">
                          {hasMedia && <div className="mb-2 rounded-lg overflow-hidden">{mediaNode("aspect-video w-full")}</div>}
                          <p className="text-[11px] font-bold text-[#1a9c4d] mb-1">{displayName}</p>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#2f3940]">{caption || <span className="text-slate-400">Your message will appear here.</span>}</p>
                          <div className="mt-1 flex items-center justify-end gap-1">
                            <span className="text-[10px] text-[#6dad77]">Now</span>
                            <span className="text-[10px] text-[#6dad77]">✓✓</span>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-1">
                          <button className="flex items-center gap-1 rounded-full bg-[#e8f5e9] px-2.5 py-1 text-[11px] text-[#1a9c4d] hover:bg-[#d4edda] transition-colors">❤️ <span className="font-bold ml-0.5">0</span></button>
                          <button className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500 hover:bg-slate-200 transition-colors">+ Add</button>
                        </div>
                      </div>
                    );

                    // ── Pinterest ──────────────────────────────────────────
                    if (id === "pinterest") return (
                      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm max-w-sm mx-auto">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E60023] text-white text-xs font-bold">P</span>
                            <div>
                              <p className="text-xs font-bold text-slate-800">{displayName}</p>
                              <p className="text-[10px] text-slate-400">Postelligence Pins</p>
                            </div>
                          </div>
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-[#E60023]">Pin</span>
                        </div>
                        {hasMedia ? (
                          <div className="mb-3 rounded-xl overflow-hidden aspect-[3/4] bg-slate-100 flex items-center justify-center relative">
                            {mediaNode("w-full h-full object-cover")}
                          </div>
                        ) : (
                          <div className="mb-3 rounded-xl border-2 border-dashed border-red-200 bg-red-50/50 p-6 text-center">
                            <ImageIcon className="mx-auto h-8 w-8 text-[#E60023]/60 mb-1" />
                            <p className="text-xs font-bold text-[#E60023]">Pinterest requires media</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Attach an image or video to generate a Pin</p>
                          </div>
                        )}
                        {postTitle && <p className="text-xs font-black text-slate-900 mb-1">{postTitle}</p>}
                        <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">{caption || <span className="text-slate-400">Your Pin description will appear here (up to 800 characters).</span>}</p>
                        <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-400">
                          <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" /> Save</span>
                          <span className="flex items-center gap-1"><Share2 className="h-3.5 w-3.5" /> Share</span>
                        </div>
                      </div>
                    );

                    // ── Default / no platform selected ────────────────────
                    return (
                      <div>
                        <div className="mb-4 flex items-center gap-2.5">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1f2528]">
                            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[#1f2528]">{displayName}</p>
                            <p className="text-xs text-slate-400">{selectedPlatformNames}</p>
                          </div>
                        </div>
                        {hasMedia && (
                          <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm aspect-video flex items-center justify-center relative">
                            {imageAttachmentPreviews[0] ? (
                              <>
                                <img src={imageAttachmentPreviews[0]} alt="" className="w-full h-full object-cover" />
                                {imageAttachments.length > 1 && <span className="absolute bottom-1.5 right-1.5 rounded-full bg-[#1f2528]/70 px-2 py-0.5 text-[11px] font-bold text-white">1/{imageAttachments.length}</span>}
                              </>
                            ) : attachment?.type.startsWith("video/") ? <video src={attachmentPreview || undefined} controls className="w-full h-full object-cover bg-black" />
                              : mediaUrlIsVideo ? <video src={mediaUrlValue} preload="metadata" controls className="w-full h-full object-cover bg-black" />
                              : mediaUrlValue ? <img src={mediaUrlValue} alt="" className="w-full h-full object-cover" />
                              : <div className="flex items-center gap-2 p-3 text-xs text-slate-500 w-full"><FileText className="h-4 w-4 shrink-0 text-slate-400" /><span className="truncate font-medium">{attachment?.name}</span></div>}
                          </div>
                        )}
                        {postTitle && <p className="mb-2 text-sm font-black text-[#1f2528]">{postTitle}</p>}
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#2f3940]">{caption || "Your post text will appear here."}</p>
                        <p className="mt-2 text-xs text-slate-400">Select a platform above to see its preview</p>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Account Status Card */}
              <div className="rounded-lg border border-[#1f2528]/10 bg-white p-4 shadow-[0_8px_32px_rgba(31,37,40,0.08)]">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-black text-[#1f2528]">Account Status</p>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {selectedConnectedPlatforms.length} Connected
                  </span>
                </div>
                <div className="space-y-2">
                  {selectedPlatformDetails.map((platform) => (
                    <div key={platform.id} className="flex items-center justify-between rounded-lg bg-[#f9faf7] px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <PlatformLogo id={platform.id} className="h-3.5 w-3.5 shrink-0" style={{ color: platform.color }} />
                        <span className="font-bold text-slate-800 truncate">{platform.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {platform.connected ? (
                          <>
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span className="text-[11px] font-medium text-slate-500 truncate max-w-[110px]">{platform.handle}</span>
                          </>
                        ) : (
                          <>
                            <span className="h-2 w-2 rounded-full bg-rose-500" />
                            <span className="text-[11px] font-bold text-rose-600">Not connected</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {selectedPlatforms.length === 0 && (
                    <p className="text-xs text-slate-400 italic">Select channels above to see account status</p>
                  )}
                </div>
              </div>

              {/* Optimal Posting Times Card */}
              <div className="rounded-lg border border-[#1f2528]/10 bg-white p-4 shadow-[0_8px_32px_rgba(31,37,40,0.08)]">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-black text-[#1f2528]">Optimal Posting Times</p>
                  <CalendarClock className="h-4 w-4 text-[#2f7867]" />
                </div>
                <div className="space-y-2">
                  {selectedPlatformDetails.slice(0, 4).map((p) => {
                    const times: Record<string, string> = {
                      instagram: "11:00 AM & 7:00 PM",
                      facebook: "1:00 PM & 3:00 PM",
                      linkedin: "8:30 AM & 12:00 PM",
                      youtube: "2:00 PM & 4:00 PM",
                      twitter: "9:00 AM & 1:00 PM",
                      threads: "10:00 AM & 8:00 PM",
                      bluesky: "12:00 PM & 6:00 PM",
                      pinterest: "8:00 PM & 11:00 PM",
                      telegram: "10:00 AM & 5:00 PM",
                    };
                    return (
                      <div key={p.id} className="flex items-center justify-between rounded-lg bg-[#f9faf7] px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <PlatformLogo id={p.id} className="h-3.5 w-3.5 shrink-0" style={{ color: p.color }} />
                          <span className="font-bold text-slate-800">{p.name}</span>
                        </div>
                        <span className="font-bold text-[#2f7867]">{times[p.id] || "12:00 PM"}</span>
                      </div>
                    );
                  })}
                  {selectedPlatforms.length === 0 && (
                    <p className="text-xs text-slate-400 italic">Select channels above to see optimal times</p>
                  )}
                </div>
              </div>

              {/* Platform Needs Card */}
              <div className="rounded-lg border border-[#1f2528]/10 bg-white p-4 shadow-[0_8px_32px_rgba(31,37,40,0.08)]">
                <p className="mb-3 text-sm font-black text-[#1f2528]">Platform needs</p>
                <div className="space-y-2">
                  {platformGuidance.map((item) => (
                    <div key={item} className="flex gap-2 rounded-lg bg-[#f9faf7] p-3 text-xs leading-5 text-slate-600">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2f7867]" /><span>{item}</span>
                    </div>
                  ))}
                </div>
                {disconnectedSelectedPlatforms.length > 0 && (
                  <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-600">
                    Connect {disconnectedSelectedPlatforms.map((p) => p.name).join(", ")} before publishing.
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </motion.section>

      {/* ── Publish modal ── */}
      <AnimatePresence>
        {publishModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-[#1f2528]/35 p-4 backdrop-blur-xl"
            onClick={() => setPublishModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="w-full max-w-lg rounded-lg border border-[#1f2528]/10 bg-white p-6 shadow-[0_30px_100px_rgba(31,37,40,0.22)]"
              onClick={(e) => e.stopPropagation()}>
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <Badge className="mb-3 border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                    <Send className="h-3.5 w-3.5" />{publishResults.length > 0 ? "Publish report" : "Final review"}
                  </Badge>
                  <h3 className="text-2xl font-black tracking-[-0.04em]">Publishing to {selectedPlatforms.length} platforms</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    {imageAttachments.length > 1 ? `${imageAttachments.length} images are attached. `
                      : imageAttachments.length === 1 ? `${imageAttachments[0].name} is attached. `
                      : attachment ? `${attachment.name} is attached. ` : ""}
                    {mediaUrl ? "Hosted media URL is ready for media-first platforms." : "Text-first platforms can publish immediately."}
                  </p>
                </div>
                <Button variant="ghost" size="icon" disabled={publishing} onClick={() => setPublishModal(false)}><X className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-2">
                {selectedPlatforms.map((id) => {
                  const platform = platforms.find((p) => p.id === id);
                  const result = publishResults.find((r) => r.platform === id);
                  if (!platform) return null;
                  return (
                    <div key={id} className="flex items-center gap-3 rounded-2xl border border-[#1f2528]/10 bg-[#fbfbf7] p-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#1f2528]/10 bg-white" style={{ color: platform.color }}>
                        <PlatformLogo id={id} className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">{platform.name}</p>
                        <p className={cn("text-xs", result?.status === "failed" ? "text-rose-600" : "text-slate-500")}>
                          {result?.message || (platform.connected ? platform.handle : "Connection required before publishing")}
                        </p>
                      </div>
                      {publishing ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                        : result?.status === "published" ? <Check className="h-4 w-4 text-emerald-500" />
                        : result?.status === "failed" ? <X className="h-4 w-4 text-rose-500" />
                        : result?.status === "skipped" ? <CircleDashed className="h-4 w-4 text-amber-500" />
                        : platform.connected ? <Check className="h-4 w-4 text-emerald-300" />
                        : <X className="h-4 w-4 text-slate-300" />}
                    </div>
                  );
                })}
              </div>
              {youtubeSelectedWithoutVideo && otherPlatformsSelected && !publishError && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-bold text-amber-800">⚠ YouTube will be skipped</p>
                  <p className="mt-1 text-xs leading-5 text-amber-700">
                    {youtubeSelectedWithImage ? "YouTube doesn't support image posts via the API." : "No video attached. YouTube will be excluded from this publish."}
                    {" "}<a href="https://studio.youtube.com" target="_blank" rel="noreferrer" className="underline">Post to YouTube Studio manually ↗</a>
                  </p>
                </div>
              )}
              {publishError && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-600">{publishError}</p>}
              <div className="mt-6 flex gap-3">
                <Button variant="secondary" className="flex-1" disabled={publishing || (!hasDraftContent && !publishResults.some((r) => r.status === "published"))}
                  onClick={publishResults.some((r) => r.status === "published") ? clearDraft : () => void saveDraft()}>
                  {publishResults.some((r) => r.status === "published") ? "Clear draft" : "Save draft"}
                </Button>
                <Button variant="primary" className="flex-[1.4]" disabled={publishing || !hasDraftContent || selectedPlatforms.length === 0} onClick={() => void publishPost()}>
                  {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                  {publishResults.length > 0 ? "Publish again" : "Confirm and publish"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Schedule modal ── */}
      <AnimatePresence>
        {scheduleModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-[#1f2528]/35 p-4 backdrop-blur-xl"
            onClick={() => setScheduleModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="w-full max-w-md rounded-lg border border-[#1f2528]/10 bg-white p-6 shadow-[0_30px_100px_rgba(31,37,40,0.22)]"
              onClick={(e) => e.stopPropagation()}>
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-black tracking-[-0.04em]">Schedule Post</h3>
                  <p className="mt-2 text-sm text-slate-400">Choose when to publish to your connected platforms.</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setScheduleModal(false)}><X className="h-4 w-4" /></Button>
              </div>
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
                <div className="rounded-lg bg-[#f9faf7] p-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Platforms</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedConnectedPlatforms.length > 0
                      ? selectedConnectedPlatforms.map((id) => (
                          <span key={id} className="platform-pill-glass inline-block rounded-full px-2.5 py-1 text-[11px] font-bold capitalize text-[#1a4a3a]">{id}</span>
                        ))
                      : <span className="text-xs text-slate-400">No connected platforms selected</span>}
                  </div>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setScheduleModal(false)}>Cancel</Button>
                <Button variant="primary" className="flex-1"
                  disabled={scheduleSaving || !scheduleDate || !scheduleTime || selectedConnectedPlatforms.length === 0 || !hasDraftContent}
                  onClick={() => void confirmSchedule()}>
                  {scheduleSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                  {scheduleSaving ? "Scheduling..." : "Confirm Schedule"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bluesky modal ── */}
      <AnimatePresence>
        {blueskyModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-[#1f2528]/35 p-4 backdrop-blur-xl"
            onClick={() => setBlueskyModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="w-full max-w-md rounded-lg border border-[#1f2528]/10 bg-white p-6 shadow-[0_30px_100px_rgba(31,37,40,0.22)]"
              onClick={(e) => e.stopPropagation()}>
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-black tracking-[-0.04em]">Connect Bluesky</h3>
                  <p className="mt-2 text-sm text-slate-400">Use your handle and an app password — not your main password.</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setBlueskyModal(false)}><X className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-[#1f2528]">Bluesky handle</label>
                  <input className="w-full rounded-lg border border-[#1f2528]/12 bg-white px-4 py-2.5 text-sm text-[#1f2528] outline-none focus:border-[#2f7867]/40"
                    placeholder="you.bsky.social" value={blueskyHandle} onChange={(e) => setBlueskyHandle(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-[#1f2528]">App password</label>
                  <input type="password" className="w-full rounded-lg border border-[#1f2528]/12 bg-white px-4 py-2.5 text-sm text-[#1f2528] outline-none focus:border-[#2f7867]/40"
                    placeholder="xxxx-xxxx-xxxx-xxxx" value={blueskyPassword} onChange={(e) => setBlueskyPassword(e.target.value)} />
                  <p className="mt-1.5 text-xs text-slate-400">Create one at <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noreferrer" className="text-[#2f7867] underline">bsky.app → Settings → App Passwords</a></p>
                </div>
                {blueskyError && <p className="text-sm text-rose-500">{blueskyError}</p>}
              </div>
              <div className="mt-6 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setBlueskyModal(false)}>Cancel</Button>
                <Button variant="primary" className="flex-1" disabled={blueskyLoading || !blueskyHandle || !blueskyPassword} onClick={connectBluesky}>
                  {blueskyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Library picker modal ── */}
      <AnimatePresence>
        {libraryPickerOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-[#1f2528]/35 p-4 backdrop-blur-xl"
            onClick={() => setLibraryPickerOpen(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border border-[#1f2528]/10 bg-white p-6 shadow-[0_30px_100px_rgba(31,37,40,0.22)]"
              onClick={(e) => e.stopPropagation()}>
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-black tracking-[-0.04em]">Attach from Library</h3>
                  <p className="mt-2 text-sm text-slate-400">{needsVideo ? "Choose a video saved in your Library." : "Choose an image or video saved in your Library."}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setLibraryPickerOpen(false)}><X className="h-4 w-4" /></Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {libraryLoading ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-sm font-bold text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading your library...</div>
                ) : libraryItemsForPicker.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-slate-400">
                    <Library className="h-6 w-6 text-slate-300" />
                    {needsVideo ? "No videos in your Library yet." : "Your Library is empty."}
                    <span className="text-xs">Generate an image in AI Studio or upload media in the Library tab.</span>
                  </div>
                ) : (
                  <>
                    {libraryError && <p className="mb-3 rounded-lg bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">{libraryError}</p>}
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                      {libraryItemsForPicker.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => void attachFromLibrary(item)}
                          disabled={libraryAttachingId === item.id}
                          className="group relative flex flex-col overflow-hidden rounded-xl border border-[#1f2528]/10 bg-[#f9faf7] text-left transition-all hover:border-[#2f7867]/40 hover:bg-[#f0f9f5] disabled:opacity-60"
                        >
                          <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
                            {item.file_type === "video" ? (
                              <video src={item.file_url} className="h-full w-full object-cover" muted />
                            ) : (
                              <img src={item.file_url} alt={item.file_name} className="h-full w-full object-cover" />
                            )}
                            {libraryAttachingId === item.id && (
                              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                                <Loader2 className="h-5 w-5 animate-spin text-[#2f7867]" />
                              </div>
                            )}
                          </div>
                          <p className="truncate px-2 py-1.5 text-[11px] font-semibold text-[#1f2528]">{item.file_name}</p>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Animated Google Photos Style Floating Bottom Action Bar ── */}
      <AnimatePresence>
        {selectedImageIndices.length > 0 && (
          <motion.div
            initial={{ y: 90, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 90, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-2.5 shadow-[0_20px_60px_rgba(0,0,0,0.12)] text-[#1f2528] backdrop-blur-xl max-w-xl w-[92vw] sm:w-auto"
          >
            {/* Selection Counter Badge */}
            <div className="flex items-center gap-2 border-r border-slate-200 pr-3 shrink-0">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2f7867] text-xs font-black text-white shadow-sm">
                {selectedImageIndices.length}
              </span>
              <span className="text-xs font-bold text-[#1f2528] hidden sm:inline">Selected</span>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto no-scrollbar">
              {/* Select / Deselect All */}
              <button
                type="button"
                onClick={() => {
                  if (selectedImageIndices.length === imageAttachments.length) {
                    setSelectedImageIndices([]);
                  } else {
                    setSelectedImageIndices(imageAttachments.map((_, idx) => idx));
                  }
                }}
                className="rounded-xl border border-slate-200/80 bg-slate-100/70 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200/80 transition-all whitespace-nowrap cursor-pointer"
              >
                {selectedImageIndices.length === imageAttachments.length ? "Deselect All" : "Select All"}
              </button>

              {/* Set as Primary (available when 1 photo is selected) */}
              {selectedImageIndices.length === 1 && selectedImageIndices[0] !== 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const targetIdx = selectedImageIndices[0];
                    setImageAttachments((prev) => {
                      const updated = [...prev];
                      const [moved] = updated.splice(targetIdx, 1);
                      updated.unshift(moved);
                      return updated;
                    });
                    setImageAttachmentPreviews((prev) => {
                      const updated = [...prev];
                      const [moved] = updated.splice(targetIdx, 1);
                      updated.unshift(moved);
                      return updated;
                    });
                    setSelectedImageIndices([0]);
                  }}
                  className="rounded-xl bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 text-xs font-bold hover:bg-amber-100 transition-all whitespace-nowrap cursor-pointer flex items-center gap-1"
                >
                  ⭐ Make Primary
                </button>
              )}

              {/* AI Focus for Selected Photos */}
              <button
                type="button"
                onClick={() => {
                  setAiPromptTopic(`Write caption focusing on selected ${selectedImageIndices.length} image(s)`);
                  setAiModalOpen(true);
                }}
                className="rounded-xl bg-[#2f7867]/10 text-[#2f7867] border border-[#2f7867]/20 px-3 py-1.5 text-xs font-bold hover:bg-[#2f7867]/20 transition-all whitespace-nowrap cursor-pointer flex items-center gap-1"
              >
                <Sparkles className="h-3.5 w-3.5" /> AI Focus
              </button>

              {/* Delete Selected */}
              <button
                type="button"
                onClick={() => {
                  const toDelete = [...selectedImageIndices].sort((a, b) => b - a);
                  setImageAttachments((prev) => prev.filter((_, idx) => !selectedImageIndices.includes(idx)));
                  setImageAttachmentPreviews((prev) => {
                    toDelete.forEach((idx) => {
                      if (prev[idx]) URL.revokeObjectURL(prev[idx]);
                    });
                    return prev.filter((_, idx) => !selectedImageIndices.includes(idx));
                  });
                  setSelectedImageIndices([]);
                }}
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete ({selectedImageIndices.length})
              </button>
            </div>

            {/* Close / Dismiss */}
            <button
              type="button"
              onClick={() => setSelectedImageIndices([])}
              className="rounded-full p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer shrink-0"
              title="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </>
  );
}
