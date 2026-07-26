"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { 
  ArrowRight, 
  Check, 
  Zap, 
  Shield, 
  RefreshCw, 
  Globe, 
  ThumbsUp, 
  MessageSquare, 
  Repeat, 
  Send, 
  Heart, 
  Bookmark, 
  Play, 
  Volume2, 
  Lock, 
  Plus, 
  MoreHorizontal,
  ChevronRight,
  Info
} from "lucide-react";
import { PageTransition } from "@/components/marketing/PageTransition";
import { Reveal } from "@/components/marketing/Reveal";

/* ── Brand SVG Icons ───────────────────────────────────────────────────────── */
function LinkedInIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="#0077B5">
      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
    </svg>
  );
}

function InstagramIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="url(#ig-page-grad)">
      <defs>
        <radialGradient id="ig-page-grad" cx="30%" cy="107%" r="130%">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="45%" stopColor="#fd5949" />
          <stop offset="60%" stopColor="#d6249f" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845a1.21 1.21 0 1 0 .001 2.42 1.21 1.21 0 0 0-.001-2.42z" />
    </svg>
  );
}

function YouTubeIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="#FF0000">
      <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.508 9.388.508 9.388.508s7.518 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function ThreadsIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="#000">
      <path d="M13.748 10.907c-.193-.09-.39-.175-.593-.253C12.927 8.936 11.795 7.83 9.913 7.804h-.064c-1.16 0-2.128.497-2.72 1.4L8.25 10.1c.444-.673 1.14-.82 1.655-.82h.05c.64.004 1.122.19 1.435.553.227.264.38.629.454 1.09a11.36 11.36 0 0 0-1.837-.088c-1.847.106-3.035 1.183-2.952 2.679.04.759.42 1.412 1.065 1.839.547.361 1.25.537 1.98.496.966-.053 1.724-.421 2.252-1.095.402-.512.656-1.175.767-2.012.46.278.801.643.99 1.084.321.747.34 1.974-.663 2.977-.877.877-1.93 1.256-3.523 1.267-1.768-.013-3.104-.582-3.97-1.69-.806-1.034-1.215-2.497-1.22-4.355.005-1.857.414-3.32 1.22-4.353.866-1.108 2.202-1.677 3.97-1.69 1.78.014 3.14.587 4.044 1.704.446.553.782 1.258.994 2.093l1.15-.312c-.26-1.037-.683-1.921-1.272-2.64C12.413 5.695 10.743 4.98 8.66 4.965h-.011C6.568 4.98 4.88 5.703 3.816 7.09 2.867 8.327 2.38 10.08 2.375 12c.005 1.92.492 3.673 1.44 4.91C4.88 18.297 6.568 19.02 8.65 19.035h.01c1.868-.013 3.186-.5 4.27-1.581 1.403-1.4 1.364-3.163.908-4.24-.322-.75-.939-1.358-1.838-1.79l-.002-.002a.006.006 0 0 0-.002-.001l.004.002-.252-.516zm-2.895 3.157c-.806.045-1.644-.316-1.68-.93-.026-.427.3-.907 1.259-.964.15-.009.297-.013.44-.013.458 0 .891.044 1.287.126-.154 1.91-1.165 2.74-1.948 2.781H10.853z" />
    </svg>
  );
}

function BlueskyIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} fill="#0085ff">
      <path d="M111.8 62.2C170.2 105.9 233 189.7 256 230c23-40.3 85.8-124.1 144.2-167.8C447.8 26.9 512 16 512 16s-10.9 64.2-46.2 111.8c-43.7 58.4-127.5 121.2-167.8 144.2 40.3 23 124.1 85.8 167.8 144.2 35.3 47.6 46.2 111.8 46.2 111.8s-64.2-10.9-111.8-46.2c-58.4-43.7-121.2-127.5-144.2-167.8-23 40.3-85.8 124.1-144.2 167.8C64.2 485.1 16 496 16 496s10.9-64.2 46.2-111.8c43.7-58.4 127.5-121.2 167.8-144.2-40.3-23-124.1-85.8-167.8-144.2C26.9 127.8 16 63.6 16 63.6s47.8 11.2 95.8 47.6z" />
    </svg>
  );
}

function DiscordIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 127.14 96.36" width={size} height={size} fill="#5865F2">
      <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c.9-.65,1.76-1.34,2.58-2a75.58,75.58,0,0,0,72.77,0c.82.71,1.68,1.4,2.58,2a68.43,68.43,0,0,1-10.5,5,77.7,77.7,0,0,0,6.63,10.85,105.73,105.73,0,0,0,31.56-18.83C129.18,48.51,123.38,25.75,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z" />
    </svg>
  );
}

function TelegramIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="#26A5E4">
      <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.87 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.46c.538-.196 1.006.128.832.937z" />
    </svg>
  );
}

function PinterestIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="#E60023">
      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.886 1.406-5.886s-.359-.722-.359-1.789c0-1.675.972-2.926 2.185-2.926 1.03 0 1.526.771 1.526 1.696 0 1.035-.658 2.585-.999 4.02-.283 1.2.603 2.18 1.784 2.18 2.143 0 3.791-2.261 3.791-5.524 0-2.887-2.076-4.908-5.04-4.908-3.433 0-5.449 2.572-5.449 5.234 0 1.037.4 2.146.9 2.753.1.12.115.228.085.349-.093.386-.299 1.209-.34 1.378-.053.223-.178.27-.41.163-1.529-.71-2.486-2.946-2.486-4.737 0-3.856 2.801-7.4 8.082-7.4 4.244 0 7.543 3.023 7.543 7.067 0 4.215-2.657 7.607-6.349 7.607-1.24 0-2.407-.645-2.806-1.406l-.762 2.906c-.276 1.052-1.022 2.37-1.522 3.187 1.125.347 2.316.537 3.551.537 6.621 0 11.986-5.37 11.986-11.988C24.014 5.367 18.647 0 12.017 0z" />
    </svg>
  );
}

function RedditIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="#FF4500">
      <path d="M24 11.5c0-1.654-1.346-3-3-3-.964 0-1.817.458-2.36 1.16-1.625-1.122-3.826-1.822-6.242-1.9l1.322-4.148 4.31.916c.038.847.74 1.522 1.597 1.522 1.02 0 1.848-.828 1.848-1.848s-.828-1.848-1.848-1.848c-.89 0-1.626.634-1.796 1.48L12.44 2.82a.75.75 0 0 0-.904.512L10.05 7.6C7.59 7.663 5.347 8.37 3.694 9.508 3.155 8.796 2.28 8.333 1.25 8.333c-1.654 0-3 1.346-3 3 0 1.22.735 2.27 1.787 2.723-.058.26-.087.525-.087.79 0 3.738 4.544 6.786 10.15 6.786s10.15-3.048 10.15-6.786c0-.265-.03-.53-.088-.79 1.052-.453 1.788-1.503 1.788-2.723zm-16.5 2c-.828 0-1.5-.672-1.5-1.5s.672-1.5 1.5-1.5 1.5.672 1.5 1.5-.672 1.5-1.5 1.5zm10 0c-.828 0-1.5-.672-1.5-1.5s.672-1.5 1.5-1.5 1.5.672 1.5 1.5-.672 1.5-1.5 1.5z" />
    </svg>
  );
}

function XIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="#000">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/* ── Platform Configuration & Specs ────────────────────────────────────────── */
interface Platform {
  id: string;
  name: string;
  tagline: string;
  apiLabel: string;
  color: string;
  bgLight: string;
  Icon: React.ComponentType<{ size?: number }>;
  status: "live" | "soon";
  capabilities: string[];
  mockQuote: string;
  features: {
    scheduling: boolean;
    analytics: boolean;
    media: boolean;
    textAdapt: boolean;
  };
}

const platforms: Platform[] = [
  {
    id: "linkedin",
    name: "LinkedIn",
    tagline: "Professional networking and industry authority",
    apiLabel: "Native Partner API",
    color: "#0077B5",
    bgLight: "#e8f1fb",
    Icon: LinkedInIcon,
    status: "live",
    capabilities: ["Company & personal pages", "Native video & PDF slides", "Link preview card overrides", "Rich hashtag auto-formatting"],
    mockQuote: "Success in remote teams isn't about counting hours online — it's about clear documentation, asynchronous communication, and trust. 🚀\n\nWhen you document your systems, everyone gains alignment. Here is how we set up our team wiki...",
    features: { scheduling: true, analytics: true, media: true, textAdapt: true }
  },
  {
    id: "instagram",
    name: "Instagram",
    tagline: "Visual storytelling and community engagement",
    apiLabel: "Meta Graph API",
    color: "#d6249f",
    bgLight: "#fff0ed",
    Icon: InstagramIcon,
    status: "live",
    capabilities: ["Single image & carousel posts", "Reels native scheduling", "Automatic first-comment hashtags", "Creator & Business accounts"],
    mockQuote: "Start before you feel ready. Action breeds clarity, but waiting only feeds doubt. What is one small project you are launching this week? ⚡️\n\n#productivity #creators #dailygrind #buildinpublic #solopreneur",
    features: { scheduling: true, analytics: true, media: true, textAdapt: true }
  },
  {
    id: "youtube",
    name: "YouTube",
    tagline: "Long-form authority and Shorts reach",
    apiLabel: "Google OAuth Client",
    color: "#FF0000",
    bgLight: "#fff5d7",
    Icon: YouTubeIcon,
    status: "live",
    capabilities: ["Shorts & native video publishing", "Thumbnail uploads", "Custom tags & playlists", "Public, private or unlisted queues"],
    mockQuote: "How to build a custom compiler from scratch. A deep dive into lexical analysis, parsing, AST generation, and assembly emission.",
    features: { scheduling: true, analytics: false, media: true, textAdapt: false }
  },
  {
    id: "threads",
    name: "Threads",
    tagline: "Text-first conversations and microblogs",
    apiLabel: "Meta Threads API",
    color: "#1f2528",
    bgLight: "#eceeec",
    Icon: ThreadsIcon,
    status: "live",
    capabilities: ["Rich text & link embeds", "Carousel images", "Thread line break adaptation", "Replies counting analytics"],
    mockQuote: "3 core principles for clean product design:\n\n• Space is active, not empty. Give components room to breathe.\n• Consistency over novelty. Stick to established visual patterns.\n• Typography hierarchy is 90% of user interface design.\n\nKeep it simple.",
    features: { scheduling: true, analytics: true, media: true, textAdapt: true }
  },
  {
    id: "bluesky",
    name: "Bluesky",
    tagline: "Decentralized social networking",
    apiLabel: "AT Protocol Client",
    color: "#0085ff",
    bgLight: "#e7f3fb",
    Icon: BlueskyIcon,
    status: "live",
    capabilities: ["300-character post limits", "Image card metadata", "Thread splitting support", "Native feed sync"],
    mockQuote: "Open source isn't just about sharing code; it is about building open standards that allow independent systems to communicate securely. 🦋",
    features: { scheduling: true, analytics: false, media: true, textAdapt: true }
  },
  {
    id: "discord",
    name: "Discord",
    tagline: "Community chats and announcements",
    apiLabel: "Webhooks & Bot API",
    color: "#5865F2",
    bgLight: "#eef0fc",
    Icon: DiscordIcon,
    status: "live",
    capabilities: ["Formatted markdown posts", "Rich embed blocks with colors", "Multi-channel targeting", "Role pings templates"],
    mockQuote: "**Weekly Community Hangout** 🎙️\n\nWe are hosting our weekly roundtable in the audio channel today. Drop in to share what you're working on, get design feedback, and chat with other creators!",
    features: { scheduling: true, analytics: false, media: true, textAdapt: true }
  },
  {
    id: "telegram",
    name: "Telegram",
    tagline: "Direct broadcast channels and groups",
    apiLabel: "Telegram Bot API",
    color: "#26A5E4",
    bgLight: "#e9f6fd",
    Icon: TelegramIcon,
    status: "live",
    capabilities: ["HTML & Markdown styling", "Inline link previews", "Silent notification toggles", "Media caption auto-parsing"],
    mockQuote: "Daily coding tip: Always sanitize user-provided keys before query execution. Prevents unexpected database leaks and keeps your authentication tokens secure.",
    features: { scheduling: true, analytics: false, media: true, textAdapt: true }
  },
  {
    id: "pinterest",
    name: "Pinterest",
    tagline: "Visual discovery and product shopping",
    apiLabel: "Pinterest Content API",
    color: "#BD081C",
    bgLight: "#fbe9ee",
    Icon: PinterestIcon,
    status: "soon",
    capabilities: ["Pin board targeting", "Source URL links", "Title & description limits", "Rich rich media uploads"],
    mockQuote: "",
    features: { scheduling: false, analytics: false, media: false, textAdapt: false }
  },
  {
    id: "reddit",
    name: "Reddit",
    tagline: "Subreddit communities and link sharing",
    apiLabel: "Reddit OAuth client",
    color: "#FF4500",
    bgLight: "#fff1e3",
    Icon: RedditIcon,
    status: "soon",
    capabilities: ["Subreddit rules checking", "Flair categorization", "Self-post markdown formatting", "Link sharing previews"],
    mockQuote: "",
    features: { scheduling: false, analytics: false, media: false, textAdapt: false }
  },
  {
    id: "x",
    name: "X / Twitter",
    tagline: "Real-time updates and quick hooks",
    apiLabel: "Twitter API v2",
    color: "#000000",
    bgLight: "#eceeec",
    Icon: XIcon,
    status: "soon",
    capabilities: ["280-character auto-trimming", "Image and video uploads", "Thread expansion lists", "Metric click counters"],
    mockQuote: "",
    features: { scheduling: false, analytics: false, media: false, textAdapt: false }
  }
];

const stats = [
  { icon: Globe, label: "Platforms", value: "7+" },
  { icon: Zap, label: "Avg. publish time", value: "<2s" },
  { icon: Shield, label: "Uptime SLA", value: "99.9%" },
  { icon: RefreshCw, label: "Token refresh", value: "Auto" },
];

const howItWorks = [
  {
    step: "01",
    title: "Connect once",
    desc: "Link your accounts via secure OAuth. Tokens refresh automatically in the background — you never re-authenticate.",
  },
  {
    step: "02",
    title: "Write once",
    desc: "Draft your content in Postelligence. AI adapts tone, format, and length per platform automatically.",
  },
  {
    step: "03",
    title: "Publish everywhere",
    desc: "Schedule or post instantly across all connected channels with one click.",
  },
];

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState<string>("linkedin");

  const currentPlatform = platforms.find((p) => p.id === activeTab) || platforms[0];
  const LiveIcon = currentPlatform.Icon;

  return (
    <PageTransition>
      {/* ── Hero (Kept exact copy as requested) ── */}
      <section className="relative overflow-hidden px-5 pb-16 pt-[100px] md:px-8 md:pb-24 md:pt-[104px]">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 -left-32 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-[#2f7867]/12 to-transparent blur-3xl" />
          <div className="absolute top-0 right-0 h-[500px] w-[500px] rounded-full bg-gradient-to-bl from-[#d05945]/8 to-transparent blur-3xl" />
        </div>

        <div className="mx-auto max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-[#2f7867]/20 bg-[#2f7867]/8 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#2f7867]"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2f7867]" />
            Integrations
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="marketing-display mx-auto mt-7 max-w-3xl text-center"
          >
            Every platform your
            <br />
            <span className="bg-gradient-to-r from-[#2f7867] via-[#56a98f] to-[#d05945] bg-clip-text text-transparent">
              audience lives on.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-[#4f5b62]"
          >
            Postelligence connects directly through each platform&apos;s native API — no scraping,
            no broken embeds. Connect once and publish everywhere, for good.
          </motion.p>

          {/* Stat row */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.28 }}
            className="mx-auto mt-12 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4"
          >
            {stats.map((s) => (
              <div
                key={s.label}
                className="flex flex-col items-center gap-2 rounded-2xl border border-[#1f2528]/8 bg-white/70 px-4 py-5 backdrop-blur-sm shadow-sm"
              >
                <s.icon className="h-4 w-4 text-[#2f7867]" />
                <span className="text-2xl font-bold tracking-tight text-[#1f2528]">{s.value}</span>
                <span className="text-xs font-medium text-[#627078]">{s.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── NEW Premium Interactive Platform Inspector Showcase ── */}
      <section className="px-5 pb-16 md:px-8">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="text-center mb-10">
              <span className="text-[0.68rem] font-bold uppercase tracking-widest text-[#2f7867]">Live Preview Inspector</span>
              <h2 className="text-2xl font-bold text-[#1f2528] mt-1.5">Interactive Channel Sandbox</h2>
              <p className="text-sm text-[#627078] mt-2 max-w-md mx-auto">Click any channel below to preview how our composer adapts content natively for that specific social layout.</p>
            </div>
          </Reveal>

          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] items-start bg-white/60 border border-[#1f2528]/8 rounded-[32px] p-6 backdrop-blur-xl shadow-[0_16px_50px_rgba(0,0,0,0.02)]">
            
            {/* Left Side: Brand Selector Buttons */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider text-left pl-2">Select Channel</span>
              
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
                {platforms.map((p) => {
                  const isActive = activeTab === p.id;
                  const Icon = p.Icon;
                  return (
                    <button
                      key={p.id}
                      onClick={() => p.status === "live" && setActiveTab(p.id)}
                      disabled={p.status === "soon"}
                      className={`group w-full text-left p-4.5 rounded-2xl border transition-all duration-300 flex items-center justify-between ${
                        p.status === "soon"
                          ? "bg-slate-50/50 border-slate-100 opacity-60 cursor-not-allowed"
                          : isActive
                          ? "bg-white border-[#2f7867]/30 shadow-[0_8px_30px_rgba(47,120,103,0.06)] scale-[1.01]"
                          : "bg-white/40 border-transparent hover:bg-white hover:border-[#1f2528]/8 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all"
                          style={{ 
                            background: isActive ? `${p.color}15` : "rgba(31, 37, 40, 0.04)",
                            color: isActive ? p.color : "#627078"
                          }}
                        >
                          <Icon />
                        </div>
                        <div>
                          <span className={`block text-[0.95rem] font-bold ${isActive ? "text-[#1f2528]" : "text-[#5a656c] group-hover:text-[#1f2528]"}`}>
                            {p.name}
                          </span>
                          <span className="block text-[0.72rem] text-slate-400 font-medium line-clamp-1 mt-0.5 max-w-[200px]">
                            {p.tagline}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {p.status === "soon" ? (
                          <span className="text-[0.62rem] font-extrabold uppercase bg-purple-50 text-purple-600 px-2 py-0.5 rounded border border-purple-100">WIP</span>
                        ) : (
                          <ChevronRight className={`h-4 w-4 transition-transform ${isActive ? "translate-x-1 text-[#2f7867]" : "text-slate-300 group-hover:text-slate-400"}`} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Side: Live Device Mock UI Card */}
            <div className="sticky top-6 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 min-h-[460px] flex flex-col justify-between shadow-inner">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#2f7867] animate-pulse" />
                  <span className="text-xs font-bold text-[#1f2528] uppercase tracking-wider">{currentPlatform.name} Channel Mockup</span>
                </div>
                <span className="text-[0.62rem] font-bold uppercase px-2 py-0.5 rounded bg-white border border-slate-200 text-[#627078] shadow-sm flex items-center gap-1">
                  <Lock className="h-2.5 w-2.5 text-[#2f7867]" />
                  {currentPlatform.apiLabel}
                </span>
              </div>

              {/* Dynamic Mockup Card based on active Tab */}
              <div className="flex-1 flex flex-col justify-start">
                <AnimatePresence mode="wait">
                  
                  {/* LINKEDIN MOCK */}
                  {activeTab === "linkedin" && (
                    <motion.div
                      key="linkedin-mock"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="bg-white border border-slate-200/80 rounded-xl p-4.5 text-left shadow-sm flex flex-col gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-extrabold text-[#0077B5]">JD</div>
                        <div>
                          <h4 className="text-xs font-bold text-[#1f2528] flex items-center gap-1">Jane Doe <span className="text-[10px] text-slate-400 font-normal">• 1st</span></h4>
                          <p className="text-[10px] text-slate-400">Independent Designer & Creator</p>
                          <p className="text-[9px] text-slate-400 flex items-center gap-1">1h • <Globe className="h-2.5 w-2.5" /></p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-line">
                        {currentPlatform.mockQuote}
                      </p>
                      <div className="h-44 rounded-lg bg-gradient-to-br from-[#0077B5]/10 to-[#2f7867]/5 border border-slate-100 flex flex-col items-center justify-center p-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <LinkedInIcon size={24} />
                          <span className="text-xs font-bold text-[#1f2528]">Creator Growth Workspace</span>
                        </div>
                        <div className="w-full max-w-[200px] h-2 bg-slate-200/60 rounded-full overflow-hidden">
                          <div className="h-full w-4/5 bg-[#2f7867] rounded-full" />
                        </div>
                        <span className="text-[9px] text-slate-400 mt-2">Natively attached graphic</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-slate-400">
                        <span className="flex items-center gap-1 text-[10px] hover:text-slate-600 font-bold"><ThumbsUp className="h-3.5 w-3.5" /> Like</span>
                        <span className="flex items-center gap-1 text-[10px] hover:text-slate-600 font-bold"><MessageSquare className="h-3.5 w-3.5" /> Comment</span>
                        <span className="flex items-center gap-1 text-[10px] hover:text-slate-600 font-bold"><Repeat className="h-3.5 w-3.5" /> Repost</span>
                        <span className="flex items-center gap-1 text-[10px] hover:text-slate-600 font-bold"><Send className="h-3.5 w-3.5" /> Send</span>
                      </div>
                    </motion.div>
                  )}

                  {/* INSTAGRAM MOCK */}
                  {activeTab === "instagram" && (
                    <motion.div
                      key="instagram-mock"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="bg-white border border-slate-200/80 rounded-xl p-0 text-left shadow-sm overflow-hidden flex flex-col"
                    >
                      <div className="flex items-center justify-between p-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-yellow-400 to-pink-500 p-0.5">
                            <div className="h-full w-full rounded-full bg-white flex items-center justify-center text-[10px] font-bold text-pink-600">JD</div>
                          </div>
                          <span className="text-xs font-bold text-[#1f2528]">jane_doe</span>
                        </div>
                        <MoreHorizontal className="h-4 w-4 text-slate-400" />
                      </div>
                      <div className="aspect-video w-full bg-gradient-to-tr from-purple-100 to-pink-100 flex items-center justify-center relative">
                        <span className="text-xs font-extrabold text-[#d6249f]/80 uppercase tracking-widest border border-[#d6249f]/20 bg-white/70 px-4 py-2 rounded-xl backdrop-blur-sm">Instagram Grid Visual</span>
                      </div>
                      <div className="p-3.5 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-slate-700">
                          <div className="flex gap-3">
                            <Heart className="h-4.5 w-4.5 hover:text-pink-600 cursor-pointer" />
                            <MessageSquare className="h-4.5 w-4.5" />
                            <Send className="h-4.5 w-4.5" />
                          </div>
                          <Bookmark className="h-4.5 w-4.5" />
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed font-medium">
                          <span className="font-bold mr-1.5">jane_doe</span>
                          {currentPlatform.mockQuote}
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* YOUTUBE MOCK */}
                  {activeTab === "youtube" && (
                    <motion.div
                      key="youtube-mock"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="bg-white border border-slate-200/80 rounded-xl p-4.5 text-left shadow-sm flex flex-col gap-3"
                    >
                      <div className="aspect-video w-full rounded-xl bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-cover bg-center opacity-70 bg-[radial-gradient(circle_at_center,rgba(255,0,0,0.15)_0%,transparent_100%)]" />
                        <div className="h-12 w-12 rounded-full bg-red-600 flex items-center justify-center text-white shadow-md z-10">
                          <Play className="h-5 w-5 fill-white ml-0.5" />
                        </div>
                        <div className="absolute bottom-3 right-3 bg-black/80 px-2 py-0.5 rounded text-[10px] text-white font-bold">10:42</div>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#1f2528] leading-snug">{currentPlatform.mockQuote}</h4>
                        <div className="flex items-center gap-3 mt-2">
                          <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center font-black text-red-600">JD</div>
                          <div>
                            <p className="text-xs font-bold text-slate-700">Design & Dev Tutorials</p>
                            <p className="text-[10px] text-slate-400">12k subscribers</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* THREADS MOCK */}
                  {activeTab === "threads" && (
                    <motion.div
                      key="threads-mock"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="bg-white border border-slate-200/80 rounded-xl p-4.5 text-left shadow-sm flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex gap-3">
                          <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-800">JD</div>
                          <div>
                            <h4 className="text-xs font-bold text-[#1f2528] flex items-center gap-1">jane_doe <span className="text-[10px] text-slate-300 font-normal">2h</span></h4>
                            <p className="text-xs text-slate-700 leading-relaxed font-medium mt-1 whitespace-pre-line">
                              {currentPlatform.mockQuote}
                            </p>
                          </div>
                        </div>
                        <MoreHorizontal className="h-4 w-4 text-slate-300" />
                      </div>
                      <div className="pl-12 flex items-center gap-3.5 text-slate-400">
                        <Heart className="h-4.5 w-4.5 cursor-pointer hover:text-red-500" />
                        <MessageSquare className="h-4.5 w-4.5" />
                        <Repeat className="h-4.5 w-4.5" />
                        <Send className="h-4.5 w-4.5" />
                      </div>
                      <div className="pl-12 text-[10px] text-slate-400">
                        14 replies • 248 likes
                      </div>
                    </motion.div>
                  )}

                  {/* BLUESKY MOCK */}
                  {activeTab === "bluesky" && (
                    <motion.div
                      key="bluesky-mock"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="bg-white border border-slate-200/80 rounded-xl p-4.5 text-left shadow-sm flex flex-col gap-3"
                    >
                      <div className="flex gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-[#0085ff]">JD</div>
                        <div>
                          <h4 className="text-xs font-bold text-[#1f2528]">Jane Doe <span className="text-[10px] text-slate-400 font-normal">@janedoe.bsky.social • 3h</span></h4>
                          <p className="text-xs text-slate-700 leading-relaxed font-medium mt-1.5">
                            {currentPlatform.mockQuote}
                          </p>
                          <div className="flex items-center gap-8 text-slate-400 mt-4">
                            <span className="flex items-center gap-1.5 text-[10px] hover:text-[#0085ff]"><MessageSquare className="h-3.5 w-3.5" /> 8</span>
                            <span className="flex items-center gap-1.5 text-[10px] hover:text-green-500"><Repeat className="h-3.5 w-3.5" /> 16</span>
                            <span className="flex items-center gap-1.5 text-[10px] hover:text-pink-500"><Heart className="h-3.5 w-3.5" /> 42</span>
                            <span className="flex items-center gap-1.5 text-[10px] hover:text-slate-600"><Send className="h-3.5 w-3.5" /></span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* DISCORD MOCK */}
                  {activeTab === "discord" && (
                    <motion.div
                      key="discord-mock"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="bg-[#313338] rounded-xl p-4.5 text-left shadow-sm flex flex-col gap-2 font-sans"
                    >
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                        <span className="text-lg">#</span> announcements
                      </div>
                      <div className="flex gap-3">
                        <div className="h-9 w-9 rounded-full bg-[#5865F2] flex items-center justify-center font-bold text-white text-xs shrink-0">PB</div>
                        <div className="flex-1">
                          <h4 className="text-xs font-bold text-white flex items-center gap-2">Community Bot <span className="text-[8px] bg-[#5865F2] text-white px-1.5 py-0.5 rounded font-black">BOT</span> <span className="text-[9px] text-slate-400 font-normal">Today at 4:12 PM</span></h4>
                          
                          {/* Rich embed mockup */}
                          <div className="mt-2 border-l-4 border-[#5865F2] bg-[#2b2d31] rounded p-3 flex flex-col gap-1.5 max-w-[340px]">
                            <span className="text-[10px] text-slate-400 font-bold">COMMUNITY BROADCAST</span>
                            <p className="text-xs text-slate-200 font-medium whitespace-pre-line">
                              {currentPlatform.mockQuote}
                            </p>
                            <span className="text-[9px] text-slate-400 mt-2">Active Webhook integration</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* TELEGRAM MOCK */}
                  {activeTab === "telegram" && (
                    <motion.div
                      key="telegram-mock"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="bg-[#f0f2f5] border border-slate-200/80 rounded-xl p-4.5 text-left shadow-sm flex flex-col gap-3 min-h-[220px] justify-between relative overflow-hidden"
                    >
                      {/* Telegram Header */}
                      <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200">
                        <div className="h-8 w-8 rounded-full bg-[#26A5E4] flex items-center justify-center font-bold text-white text-xs">JD</div>
                        <div>
                          <h4 className="text-xs font-bold text-[#1f2528]">Dev Updates Broadcast</h4>
                          <p className="text-[10px] text-[#26A5E4]">1,280 subscribers</p>
                        </div>
                      </div>

                      {/* Chat message bubbles */}
                      <div className="flex-1 flex flex-col justify-end gap-2 my-4">
                        <div className="self-end bg-[#e1f3fc] border border-[#c1e6f7] rounded-2xl rounded-tr-sm p-3 max-w-[280px] shadow-sm text-left">
                          <p className="text-xs text-slate-700 leading-relaxed font-medium">
                            {currentPlatform.mockQuote}
                          </p>
                          <span className="block text-[8px] text-[#26A5E4] text-right mt-1 font-bold">14:15 PM</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>

              {/* Bottom Checklist Specs */}
              <div className="mt-4 pt-3 border-t border-slate-200/80 grid grid-cols-2 gap-2 text-xs font-bold text-[#627078]">
                <div className="flex items-center gap-1.5">
                  <Check className={`h-4 w-4 ${currentPlatform.features.scheduling ? "text-[#2f7867]" : "text-slate-300"}`} />
                  Scheduling: {currentPlatform.features.scheduling ? "Supported" : "Coming Soon"}
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className={`h-4 w-4 ${currentPlatform.features.analytics ? "text-[#2f7867]" : "text-slate-300"}`} />
                  Analytics: {currentPlatform.features.analytics ? "Supported" : "Coming Soon"}
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className={`h-4 w-4 ${currentPlatform.features.media ? "text-[#2f7867]" : "text-slate-300"}`} />
                  Media uploads: {currentPlatform.features.media ? "Full" : "N/A"}
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className={`h-4 w-4 ${currentPlatform.features.textAdapt ? "text-[#2f7867]" : "text-slate-300"}`} />
                  AI adaptation: {currentPlatform.features.textAdapt ? "Active" : "Standard"}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── NEW Features Integration Technical Matrix Table ── */}
      <section className="px-5 pb-16 md:px-8">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="text-center mb-10">
              <span className="text-[0.68rem] font-bold uppercase tracking-widest text-[#2f7867]">Specifications</span>
              <h2 className="text-2xl font-bold text-[#1f2528] mt-1.5">Capability Handshake Matrix</h2>
              <p className="text-sm text-[#627078] mt-2 max-w-md mx-auto">Compare deep integrations features, credentials limits, and adaptation properties across networks.</p>
            </div>
          </Reveal>

          <div className="overflow-x-auto rounded-[24px] border border-[#1f2528]/8 bg-white/70 backdrop-blur-sm shadow-[0_12px_40px_rgba(0,0,0,0.02)]">
            <table className="w-full min-w-[600px] text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1f2528]/8 bg-[#fbfbf9]/60 text-[#1f2528] text-[0.78rem] uppercase font-bold tracking-wider">
                  <th className="p-4.5 pl-6">Platform</th>
                  <th className="p-4.5">API Handshake</th>
                  <th className="p-4.5 text-center">Scheduler</th>
                  <th className="p-4.5 text-center">Analytics</th>
                  <th className="p-4.5 text-center">AI Tone Shift</th>
                  <th className="p-4.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f2528]/5 text-slate-700 text-sm">
                {platforms.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="p-4 pl-6 font-bold text-[#1f2528] flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50/80 border border-slate-100">
                        <p.Icon size={16} />
                      </div>
                      {p.name}
                    </td>
                    <td className="p-4 text-[0.82rem] font-medium text-[#627078]">
                      {p.apiLabel}
                    </td>
                    <td className="p-4 text-center">
                      {p.features.scheduling ? (
                        <Check className="h-4.5 w-4.5 text-[#2f7867] mx-auto" />
                      ) : (
                        <span className="text-[10px] font-bold text-slate-300">WIP</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {p.features.analytics ? (
                        <Check className="h-4.5 w-4.5 text-[#2f7867] mx-auto" />
                      ) : (
                        <span className="text-[10px] font-bold text-slate-300">WIP</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {p.features.textAdapt ? (
                        <Check className="h-4.5 w-4.5 text-[#2f7867] mx-auto" />
                      ) : (
                        <span className="text-[10px] font-bold text-slate-300">WIP</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider ${
                        p.status === "soon"
                          ? "bg-purple-50 text-purple-600 border border-purple-100"
                          : "bg-[#eaf7ef] text-[#20613a] border border-[#bfe2c9]"
                      }`}>
                        {p.status === "soon" ? "Soon" : "Live"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── How It Works (Kept EXACTLY as shown in photo 2, light theme card) ── */}
      <section className="px-5 py-16 md:px-8 md:py-20">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-[#1f2528]/8 bg-gradient-to-b from-[#fbfbf9] to-[#f5f6f0] px-8 py-14 md:px-14 md:py-16 shadow-sm">
              {/* Orb decorations */}
              <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[#2f7867]/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-[#d05945]/5 blur-3xl" />

              <p className="relative text-xs font-bold uppercase tracking-widest text-[#2f7867]">
                How it works
              </p>
              <div className="relative mt-10 grid gap-10 md:grid-cols-3">
                {howItWorks.map((item) => (
                  <div key={item.step} className="flex flex-col gap-4">
                    <span className="text-5xl font-black text-[#2f7867]/40 leading-none">
                      {item.step}
                    </span>
                    <div className="h-px w-10 bg-gradient-to-r from-[#2f7867] to-transparent" />
                    <h3 className="text-lg font-bold text-[#1f2528]">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-[#3b444a] font-semibold">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-5 pb-28 md:px-8">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="flex flex-col items-center gap-6 rounded-3xl border border-[#2f7867]/20 bg-gradient-to-b from-[#f0f8f5] to-[#f6f7f1] p-10 text-center md:p-16">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#2f7867]">
                <Globe className="h-3.5 w-3.5" />
                Don&apos;t see your platform?
              </span>
              <h2 className="text-3xl font-bold tracking-[-0.03em] text-[#1f2528] md:text-4xl">
                Tell us what you need next.
              </h2>
              <p className="max-w-lg text-base leading-relaxed text-[#5a656c]">
                We ship new integrations based on direct creator feedback — most requests go from
                idea to shipped in under a few weeks.
              </p>
              <Link href="/login" className="marketing-cta-primary">
                Request an integration
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

    </PageTransition>
  );
}
