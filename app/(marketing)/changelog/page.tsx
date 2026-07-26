"use client";

import { motion } from "framer-motion";
import { Bot, Calendar, Globe2, Library, ShieldCheck, Sparkles, ArrowRight, Zap, Star, TrendingUp } from "lucide-react";
import Link from "next/link";
import { PageTransition } from "@/components/marketing/PageTransition";
import { Reveal } from "@/components/marketing/Reveal";

const entries = [
  { date: "June 2026", tag: "New", tagColor: "#20613a", tagBg: "#eaf7ef", icon: Globe2, iconColor: "#2f7867", iconBg: "#eaf7ef", accentColor: "#2f7867", title: "Bluesky & Reddit publishing", copy: "Connect Bluesky and Reddit accounts and publish natively alongside your other channels. Full AT Protocol support and subreddit flair included.", highlights: ["AT Protocol", "Subreddit flair", "Rich text"] },
  { date: "May 2026", tag: "Improved", tagColor: "#7a5a00", tagBg: "#fff5d7", icon: Bot, iconColor: "#6d5ad0", iconBg: "#f0eeff", accentColor: "#6d5ad0", title: "AI Studio brand voice tuning", copy: "AI Studio now learns from your edit history to match your brand voice more precisely. The more you use it, the better it gets at sounding like you.", highlights: ["Edit-history learning", "Tone matching", "Brand memory"] },
  { date: "April 2026", tag: "New", tagColor: "#20613a", tagBg: "#eaf7ef", icon: Calendar, iconColor: "#0077B5", iconBg: "#e8f1fb", accentColor: "#0077B5", title: "Drag-and-drop calendar rescheduling", copy: "Move scheduled posts across days directly on the visual calendar — no dialogs required. Just drag, drop, and you're done.", highlights: ["Visual calendar", "No dialog friction", "Instant reschedule"] },
  { date: "March 2026", tag: "New", tagColor: "#20613a", tagBg: "#eaf7ef", icon: Library, iconColor: "#7a5a00", iconBg: "#fff5d7", accentColor: "#d05945", title: "Expanded media library", copy: "Smart search, AI tagging, and bulk uploads make finding the right asset instant. Your visual library finally works as hard as you do.", highlights: ["AI tagging", "Bulk upload", "Smart search"] },
  { date: "February 2026", tag: "Improved", tagColor: "#7a5a00", tagBg: "#fff5d7", icon: ShieldCheck, iconColor: "#1f2528", iconBg: "#eceeec", accentColor: "#627078", title: "Hardened OAuth security", copy: "Refreshed encryption for all stored sessions plus clearer per-platform permission controls. Your account data is safer than ever.", highlights: ["Refreshed encryption", "Per-platform perms", "Session hardening"] },
  { date: "January 2026", tag: "Launch", tagColor: "#7c5cbf", tagBg: "#f5f0ff", icon: Sparkles, iconColor: "#d05945", iconBg: "#fff0ed", accentColor: "#d05945", title: "Postelligence launches publicly", copy: "Unified composer, AI Studio, scheduling, and analytics — all in one calm workspace. The beginning of a new way to create and publish.", highlights: ["Unified composer", "AI Studio", "Analytics"] },
];

const stats = [
  { icon: Zap, value: "6", label: "Releases shipped" },
  { icon: Star, value: "7+", label: "Platforms live" },
  { icon: TrendingUp, value: "100%", label: "Creator-driven" },
];

export default function ChangelogPage() {
  return (
    <PageTransition>
      <section className="relative overflow-hidden px-5 pb-16 pt-[100px] md:px-8 md:pb-24 md:pt-[104px]">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 -left-32 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-[#2f7867]/10 to-transparent blur-3xl" />
          <div className="absolute top-0 right-0 h-[400px] w-[400px] rounded-full bg-gradient-to-bl from-[#d05945]/8 to-transparent blur-3xl" />
        </div>
        <div className="mx-auto max-w-4xl text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="inline-flex items-center gap-2 rounded-full border border-[#2f7867]/20 bg-[#2f7867]/8 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#2f7867]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2f7867]" />
            Changelog
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }} className="marketing-display mx-auto mt-7 max-w-3xl">
            What&apos;s new in
            <br />
            <span className="bg-gradient-to-r from-[#2f7867] via-[#56a98f] to-[#d05945] bg-clip-text text-transparent">Postelligence.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.18 }} className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-[#4f5b62]">
            Every feature, fix, and platform we ship — in plain language, as it happens.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.26 }} className="mx-auto mt-10 flex flex-wrap items-center justify-center gap-4">
            {stats.map((s) => (
              <div key={s.label} className="flex items-center gap-2.5 rounded-2xl border border-[#1f2528]/8 bg-white/70 px-5 py-3 backdrop-blur-sm">
                <s.icon className="h-4 w-4 text-[#2f7867]" />
                <span className="text-lg font-bold text-[#1f2528]">{s.value}</span>
                <span className="text-sm text-[#627078]">{s.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="px-5 pb-28 md:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="relative space-y-6">
            <div className="absolute bottom-0 left-6 top-0 w-px bg-gradient-to-b from-[#2f7867]/30 via-[#1f2528]/10 to-transparent" />
            {entries.map((entry, i) => {
              const Icon = entry.icon;
              return (
                <Reveal key={entry.title} delay={i * 0.07}>
                  <div className="relative flex gap-5 md:gap-7">
                    <div className="relative z-10 flex-shrink-0">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm border border-white" style={{ background: entry.iconBg }}>
                        <Icon className="h-5 w-5" style={{ color: entry.iconColor }} />
                      </div>
                    </div>
                    <motion.div whileHover={{ y: -4, scale: 1.01 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }} className="flex-1 overflow-hidden rounded-3xl border border-[#1f2528]/8 bg-white shadow-[0_4px_20px_rgba(31,37,40,0.05)] hover:shadow-[0_16px_40px_rgba(31,37,40,0.10)] transition-shadow">
                      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${entry.accentColor}, transparent)` }} />
                      <div className="p-6 md:p-7">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="text-xs font-bold uppercase tracking-widest text-[#8a949a]">{entry.date}</span>
                          <span className="rounded-full px-2.5 py-0.5 text-[0.64rem] font-bold uppercase tracking-wider" style={{ background: entry.tagBg, color: entry.tagColor }}>{entry.tag}</span>
                        </div>
                        <h2 className="mt-3 text-xl font-bold tracking-[-0.02em] text-[#1f2528]">{entry.title}</h2>
                        <p className="mt-2.5 text-sm leading-relaxed text-[#627078]">{entry.copy}</p>
                        <div className="mt-5 flex flex-wrap gap-2">
                          {entry.highlights.map((h) => (
                            <span key={h} className="rounded-lg px-2.5 py-1 text-[0.7rem] font-semibold" style={{ background: entry.iconBg, color: entry.iconColor }}>{h}</span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </Reveal>
              );
            })}
          </div>
          <Reveal className="mt-14">
            <div className="flex flex-col items-center gap-5 rounded-3xl border border-[#2f7867]/20 bg-gradient-to-b from-[#f0f8f5] to-[#f6f7f1] p-10 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-[#2f7867]">Stay in the loop</p>
              <h2 className="text-2xl font-bold tracking-[-0.03em] text-[#1f2528]">New features ship weekly.</h2>
              <p className="max-w-sm text-sm leading-relaxed text-[#5a656c]">Join Postelligence and you&apos;ll always be on the latest version — no manual updates, ever.</p>
              <Link href="/login" className="marketing-cta-primary">Get started free<ArrowRight className="h-4 w-4" /></Link>
            </div>
          </Reveal>
        </div>
      </section>
    </PageTransition>
  );
}
