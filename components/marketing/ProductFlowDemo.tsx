"use client";

import { motion } from "framer-motion";
import { Link2, PenLine, RefreshCw } from "lucide-react";

const steps = [
  {
    step: "01",
    title: "Connect Your Channels",
    desc: "Link your profiles natively via secure OAuth. Postelligence establishes a direct handshake with LinkedIn, Instagram, Threads, and Bluesky — no scraping, no middlemen.",
    icon: Link2,
    color: "#2f7867",
    bg: "rgba(47, 120, 103, 0.05)"
  },
  {
    step: "02",
    title: "Draft a Master Post",
    desc: "Write your core thoughts inside a single distraction-free composer. Add images, outlines, or links without worrying about character boxes or platform limits.",
    icon: PenLine,
    color: "#0077B5",
    bg: "rgba(0, 119, 181, 0.05)"
  },
  {
    step: "03",
    title: "Auto-Format & Sync",
    desc: "Postelligence automatically optimizes lengths, fits formatting rules, splits threads, translates hashtags, and broadcasts natively across your chosen channels.",
    icon: RefreshCw,
    color: "#d05945",
    bg: "rgba(208, 89, 69, 0.05)"
  }
];

export function ProductFlowDemo() {
  return (
    <div className="mx-auto max-w-5xl grid gap-4 sm:gap-6 lg:gap-8 grid-cols-1 md:grid-cols-3 items-stretch select-none">
      {steps.map((item, idx) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={item.step}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: idx * 0.1, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -6 }}
            className="flex flex-col justify-between p-5 sm:p-7 rounded-[24px] border border-[#1f2528]/8 bg-white shadow-[0_12px_30px_rgba(0,0,0,0.02)] transition-all duration-300 relative group"
          >
            {/* Ambient hover glow */}
            <div 
              className="absolute inset-0 rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none -z-10" 
              style={{
                background: `radial-gradient(circle at 50% 0%, ${item.bg}, transparent 70%)`
              }}
            />

            <div className="space-y-5 text-left">
              {/* Header Icon & Number */}
              <div className="flex items-center justify-between">
                <div 
                  className="h-10 w-10 rounded-xl flex items-center justify-center border border-slate-100 bg-slate-50 transition-colors group-hover:bg-white"
                  style={{ color: item.color }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-4xl font-black opacity-10 font-mono tracking-tight group-hover:opacity-20 transition-opacity">
                  {item.step}
                </span>
              </div>

              {/* Title & Divider */}
              <div>
                <h4 className="text-lg font-black text-[#1f2528] tracking-tight">
                  {item.title}
                </h4>
                <div 
                  className="h-[2px] w-8 mt-2.5 transition-all duration-300 group-hover:w-16" 
                  style={{ backgroundColor: item.color }}
                />
              </div>

              {/* Description */}
              <p className="text-xs leading-relaxed text-[#3b444a] font-semibold">
                {item.desc}
              </p>
            </div>
            
            <div className="pt-6 text-[10px] font-black uppercase tracking-wider text-slate-300 group-hover:text-slate-400 transition-colors mt-4 text-left">
              Step {item.step} Workflow
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}