"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Heart, Lightbulb, Target, ArrowRight, Users, Rocket, Globe2, Quote } from "lucide-react";
import { PageTransition } from "@/components/marketing/PageTransition";
import { Reveal } from "@/components/marketing/Reveal";

const values = [
  { icon: Target, title: "Clarity over complexity", copy: "Social tools should not feel like a second job. We design every screen to reduce noise and amplify focus, so you spend time creating — not navigating.", color: "#2f7867", bg: "#eaf7ef" },
  { icon: Lightbulb, title: "AI as a collaborator", copy: "Artificial intelligence should enhance your voice — not replace it. Postelligence AI adapts to you, learning your style and tone the more you use it.", color: "#6d5ad0", bg: "#f0eeff" },
  { icon: Heart, title: "Built for creators", copy: "From solo writers to growing teams, Postelligence exists because publishing great content deserves great tools. We ship for the people doing the work.", color: "#d05945", bg: "#fff0ed" },
];

const milestones = [
  { icon: Rocket, label: "Founded", value: "Jan 2026", detail: "Postelligence publicly launched" },
  { icon: Globe2, label: "Platforms", value: "7+", detail: "Native API integrations" },
  { icon: Users, label: "Creators", value: "Growing", detail: "Teams and solo builders" },
];

export default function AboutPage() {
  return (
    <PageTransition>
      <section className="relative overflow-hidden px-5 pb-16 pt-[100px] md:px-8 md:pb-24 md:pt-[104px]">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 -left-32 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-[#2f7867]/10 to-transparent blur-3xl" />
          <div className="absolute bottom-0 right-0 h-[500px] w-[500px] rounded-full bg-gradient-to-tl from-[#d05945]/8 to-transparent blur-3xl" />
        </div>
        <div className="mx-auto max-w-4xl text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="inline-flex items-center gap-2 rounded-full border border-[#2f7867]/20 bg-[#2f7867]/8 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#2f7867]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2f7867]" />
            About Postelligence
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }} className="marketing-display mx-auto mt-7 max-w-3xl">
            Great content deserves a
            <br />
            <span className="bg-gradient-to-r from-[#2f7867] via-[#56a98f] to-[#d05945] bg-clip-text text-transparent">calmer way to the world.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.18 }} className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-[#4f5b62]">
            Postelligence was born from a simple frustration: creators spend more time copying, pasting, and reformatting than actually creating. We set out to fix that.
          </motion.p>
        </div>
      </section>

      <section className="px-5 pb-16 md:px-8">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-[#2f7867]/20 bg-gradient-to-b from-[#f0f8f5] to-[#f6f7f1] px-8 py-14 md:px-16 md:py-20">
              <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[#2f7867]/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-[#d05945]/5 blur-3xl" />
              <Quote className="relative mb-6 h-10 w-10 text-[#2f7867]" />
              <blockquote className="relative text-2xl font-semibold leading-snug tracking-[-0.03em] text-[#1f2528] md:text-4xl max-w-3xl">
                Create once, publish everywhere — and never lose your voice in the process.
              </blockquote>
              <p className="relative mt-8 max-w-2xl text-base leading-relaxed text-[#4f5b62]">
                Every feature we ship is measured against one question: does this help creators show up more consistently, with less effort, and more authenticity? If the answer is no, it does not ship.
              </p>
              <p className="relative mt-6 text-sm font-bold uppercase tracking-widest text-[#2f7867]">Our mission</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="px-5 pb-16 md:px-8">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <div className="grid gap-4 sm:grid-cols-3">
              {milestones.map((m) => (
                <div key={m.label} className="flex flex-col items-center gap-3 rounded-3xl border border-[#1f2528]/8 bg-white px-6 py-8 text-center shadow-[0_4px_20px_rgba(31,37,40,0.05)]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2f7867]/10">
                    <m.icon className="h-5 w-5 text-[#2f7867]" />
                  </div>
                  <div className="text-3xl font-black tracking-tight text-[#1f2528]">{m.value}</div>
                  <div className="text-sm font-bold text-[#1f2528]">{m.label}</div>
                  <div className="text-xs text-[#627078]">{m.detail}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="px-5 pb-16 md:px-8">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <div className="text-center mb-12">
              <p className="text-xs font-bold uppercase tracking-widest text-[#2f7867]">Our principles</p>
              <h2 className="mt-4 text-3xl font-bold tracking-[-0.03em] text-[#1f2528] md:text-4xl">What we stand for.</h2>
            </div>
          </Reveal>
          <div className="grid gap-5 md:grid-cols-3">
            {values.map(({ icon: Icon, title, copy, color, bg }, i) => (
              <Reveal key={title} delay={i * 0.08}>
                <motion.div whileHover={{ y: -6, scale: 1.02 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="relative flex flex-col overflow-hidden rounded-3xl border border-[#1f2528]/8 bg-white p-7 shadow-[0_4px_20px_rgba(31,37,40,0.05)] hover:shadow-[0_16px_40px_rgba(31,37,40,0.10)] transition-shadow">
                  <div className="h-1 w-16 rounded-full mb-6" style={{ background: color }} />
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl mb-5" style={{ background: bg }}>
                    <Icon className="h-5 w-5" style={{ color }} />
                  </div>
                  <h3 className="text-xl font-bold tracking-[-0.02em] text-[#1f2528]">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#627078]">{copy}</p>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-28 md:px-8">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <div className="flex flex-col items-center gap-6 rounded-3xl border border-[#2f7867]/20 bg-gradient-to-b from-[#f0f8f5] to-[#f6f7f1] p-10 text-center md:p-16">
              <p className="text-xs font-bold uppercase tracking-widest text-[#2f7867]">Ready to create?</p>
              <h2 className="text-3xl font-bold tracking-[-0.03em] text-[#1f2528] md:text-4xl">Join the Postelligence community.</h2>
              <p className="max-w-lg text-base leading-relaxed text-[#5a656c]">Whether you&apos;re a solo creator or building a content team, Postelligence gives you the tools to show up consistently, everywhere that matters.</p>
              <Link href="/login" className="marketing-cta-primary">Get started free<ArrowRight className="h-4 w-4" /></Link>
            </div>
          </Reveal>
        </div>
      </section>
    </PageTransition>
  );
}
