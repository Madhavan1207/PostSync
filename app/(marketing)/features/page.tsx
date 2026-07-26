"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ArrowRight, BarChart3, Bot, Calendar, Globe2, Layers, Library, PenLine, Shield, CheckCircle2, Sparkles, Zap } from "lucide-react";
import { PageTransition } from "@/components/marketing/PageTransition";
import { Reveal } from "@/components/marketing/Reveal";

const features = [
  { icon: PenLine, title: "Unified Composer", copy: "Write once with rich media support. Postelligence auto-formats and optimizes for every platform — character limits, hashtags, and all.", tag: "Create", color: "#2f7867", bg: "#eaf7ef", highlight: "Write once, publish everywhere" },
  { icon: Bot, title: "AI Studio", copy: "Generate captions, rewrite for tone, and brainstorm hooks — grounded in your brand voice, never generic.", tag: "Intelligence", color: "#6d5ad0", bg: "#f0eeff", highlight: "Your voice, amplified by AI" },
  { icon: Calendar, title: "Visual Calendar", copy: "See your entire content week at a glance. Drag, drop, and reschedule in seconds without breaking your flow.", tag: "Schedule", color: "#0077B5", bg: "#e8f1fb", highlight: "Total schedule visibility" },
  { icon: Globe2, title: "Multi-platform Publishing", copy: "LinkedIn, Instagram, YouTube, Threads, Bluesky, Pinterest and more — one workflow, every channel.", tag: "Distribute", color: "#d05945", bg: "#fff0ed", highlight: "7+ platforms, one click" },
  { icon: Library, title: "Smart Media Library", copy: "Organize assets with AI-powered tagging and smart search. Reuse your best visuals across campaigns in seconds.", tag: "Assets", color: "#7a5a00", bg: "#fff5d7", highlight: "Find any asset instantly" },
  { icon: BarChart3, title: "Analytics That Clarify", copy: "Track reach, engagement, and follower growth with dashboards built for decisions — not data dumps.", tag: "Insights", color: "#0085ff", bg: "#e7f3fb", highlight: "Insights you can act on" },
  { icon: Layers, title: "Drafts & Workflows", copy: "Save ideas, collaborate on reviews, and move from draft to published with zero friction and full version history.", tag: "Workflow", color: "#a53b28", bg: "#fbe9ee", highlight: "From idea to published" },
  { icon: Shield, title: "Secure by Design", copy: "OAuth connections, encrypted sessions, and platform-native APIs keep your accounts and data protected at every layer.", tag: "Trust", color: "#1f2528", bg: "#eceeec", highlight: "Bank-grade security" },
];

const highlights = [
  { icon: Sparkles, text: "AI that learns your voice" },
  { icon: Zap, text: "Publish in under 2 seconds" },
  { icon: CheckCircle2, text: "No duplicate work, ever" },
  { icon: Globe2, text: "7+ platforms connected" },
];

export default function FeaturesPage() {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <PageTransition>
      <section className="relative overflow-hidden px-5 pb-16 pt-[100px] md:px-8 md:pb-24 md:pt-[104px]">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#2f7867]/10 to-transparent blur-3xl" />
        </div>
        <div className="mx-auto max-w-4xl text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="inline-flex items-center gap-2 rounded-full border border-[#2f7867]/20 bg-[#2f7867]/8 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#2f7867]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2f7867]" />
            Features
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }} className="marketing-display mx-auto mt-7 max-w-3xl">
            Designed for creators who
            <br />
            <span className="bg-gradient-to-r from-[#2f7867] via-[#56a98f] to-[#d05945] bg-clip-text text-transparent">publish with purpose.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.18 }} className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-[#4f5b62]">
            Every tool in Postelligence shares one goal: remove friction between your ideas and your audience. No clutter. No duplicate work. Just a calm, powerful workspace.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.26 }} className="mt-10 flex flex-wrap items-center justify-center gap-3">
            {highlights.map((h) => (
              <div key={h.text} className="flex items-center gap-2 rounded-full border border-[#1f2528]/8 bg-white/80 px-4 py-2 text-sm font-medium text-[#1f2528] backdrop-blur-sm shadow-sm">
                <h.icon className="h-4 w-4 text-[#2f7867]" />
                {h.text}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="px-5 pb-16 md:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              const isHovered = hovered === feature.title;
              return (
                <Reveal key={feature.title} delay={(i % 4) * 0.07}>
                  <motion.div onHoverStart={() => setHovered(feature.title)} onHoverEnd={() => setHovered(null)} whileHover={{ y: -6, scale: 1.02 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="group relative flex h-full cursor-default flex-col overflow-hidden rounded-3xl border border-[#1f2528]/8 bg-white shadow-[0_4px_20px_rgba(31,37,40,0.05)] transition-shadow hover:shadow-[0_16px_40px_rgba(31,37,40,0.10)]">
                    <div className="h-1 w-full shrink-0" style={{ background: feature.color }} />
                    <div className="flex flex-1 flex-col p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: feature.bg }}>
                          <Icon className="h-5 w-5" style={{ color: feature.color }} />
                        </div>
                        <span className="mt-1 rounded-full px-2.5 py-0.5 text-[0.64rem] font-bold uppercase tracking-wider" style={{ background: feature.bg, color: feature.color }}>
                          {feature.tag}
                        </span>
                      </div>
                      <h2 className="mt-5 text-lg font-bold tracking-[-0.02em] text-[#1f2528]">{feature.title}</h2>
                      <p className="mt-2.5 flex-1 text-sm leading-relaxed text-[#627078]">{feature.copy}</p>
                      <div className="mt-5 flex items-center gap-1.5 text-xs font-bold" style={{ color: feature.color }}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {feature.highlight}
                      </div>
                    </div>
                    <AnimatePresence>
                      {isHovered && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 rounded-3xl" style={{ background: `radial-gradient(circle at 50% 0%, ${feature.color}14 0%, transparent 65%)` }} />
                      )}
                    </AnimatePresence>
                  </motion.div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 md:px-8 md:py-20">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-[#2f7867]/20 bg-gradient-to-b from-[#f0f8f5] to-[#f6f7f1] px-8 py-14 md:px-16 md:py-20 text-center">
              <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#2f7867]/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-[#d05945]/5 blur-3xl" />
              <p className="relative text-xs font-bold uppercase tracking-widest text-[#2f7867]">Everything you need</p>
              <h2 className="relative mx-auto mt-5 max-w-2xl text-3xl font-bold tracking-[-0.03em] text-[#1f2528] md:text-4xl">One workspace for your entire content operation.</h2>
              <p className="relative mx-auto mt-5 max-w-xl text-base leading-relaxed text-[#4f5b62]">From the first draft to the final publish, Postelligence handles every step so you can focus on what matters — creating content your audience loves.</p>
              <div className="relative mt-10 flex flex-wrap items-center justify-center gap-4">
                <Link href="/login" className="marketing-cta-primary">Try Postelligence free<ArrowRight className="h-4 w-4" /></Link>
                <Link href="/platforms" className="inline-flex items-center gap-2 rounded-full border border-[#1f2528]/15 bg-white px-6 py-3 text-sm font-semibold text-[#1f2528] hover:bg-slate-50 transition-colors">View integrations</Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </PageTransition>
  );
}
