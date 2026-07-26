"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { 
  ArrowRight, 
  Compass, 
  LayoutDashboard, 
  Home, 
  Layers, 
  Cpu, 
  HelpCircle, 
  Sparkles
} from "lucide-react";

export default function NotFound() {
  const quickLinks = [
    {
      title: "Explore Features",
      href: "/features",
      icon: Cpu,
      color: "#2f7867",
      bgLight: "#eaf7ef"
    },
    {
      title: "Native Integrations",
      href: "/platforms",
      icon: Layers,
      color: "#0077B5",
      bgLight: "#e8f1fb"
    },
    {
      title: "Pricing Plans",
      href: "/pricing",
      icon: Sparkles,
      color: "#d05945",
      bgLight: "#fff0ed"
    },
    {
      title: "Help & Support",
      href: "/support",
      icon: HelpCircle,
      color: "#b5a485",
      bgLight: "#fcf8f2"
    }
  ];

  return (
    <main className="relative min-h-dvh h-dvh bg-gradient-to-b from-[#fbfbf9] to-[#f5f6f0] flex items-center justify-center p-4 sm:p-6 overflow-hidden select-none">
      
      {/* Premium ambient glowing color blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-[#2f7867]/8 to-transparent blur-[120px] pointer-events-none animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-[#d05945]/5 to-transparent blur-[130px] pointer-events-none animate-pulse duration-[6000ms]" />
      
      {/* Concentric alignment radar sweeps in background (spacious and airy) */}
      <div className="absolute flex items-center justify-center pointer-events-none inset-0">
        <div className="w-[340px] h-[340px] rounded-full border border-dashed border-[#2f7867]/6 animate-[spin_80s_linear_infinite]" />
      </div>
      <div className="absolute flex items-center justify-center pointer-events-none inset-0">
        <div className="w-[560px] h-[560px] rounded-full border border-dashed border-[#2f7867]/4 animate-[spin_140s_linear_infinite_reverse]" />
      </div>

      {/* Grid texture overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#2f786702_1px,transparent_1px),linear-gradient(to_bottom,#2f786705_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      {/* Content Container (compact viewport height, no scroll) */}
      <div className="relative w-full max-w-3xl text-center flex flex-col gap-6 z-10 py-2">
        
        {/* Floating Interactive 404 Radar Indicator */}
        <div className="flex justify-center">
          <motion.div 
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="relative flex items-center justify-center h-28 w-28 rounded-full border border-[#1f2528]/8 bg-white/80 shadow-[0_12px_32px_rgba(0,0,0,0.02)] backdrop-blur-md group"
          >
            {/* Pulsing search rings */}
            <div className="absolute inset-2 rounded-full border-2 border-dashed border-[#d05945]/20 animate-spin [animation-duration:12s]" />
            <div className="absolute inset-5 rounded-full bg-red-50/30 animate-ping duration-[2500ms]" />
            
            <Compass className="h-10 w-10 text-[#d05945] stroke-[1.8] relative z-10 transition-transform duration-500 group-hover:rotate-45" />

            {/* Micro search handle badge */}
            <span className="absolute -top-1 -right-2 flex h-5 w-8 items-center justify-center rounded-full bg-[#d05945] text-[9px] font-black text-white shadow-md uppercase">404</span>
          </motion.div>
        </div>

        {/* Heading */}
        <div className="space-y-4">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Lost in Sync</span>
          <h1 className="text-3xl sm:text-5xl font-black text-[#1f2528] tracking-tight leading-tight max-w-xl mx-auto">
            This page does not exist.
          </h1>
          <p className="max-w-md mx-auto text-sm text-[#627078] leading-relaxed font-semibold">
            We couldn&apos;t find the path you requested. Don&apos;t worry — your workspaces, queue logs, and scheduled channels remain completely unaffected.
          </p>
        </div>

        {/* Helpful Destinations Map Grid - Pill style for clean, free workspace layout */}
        <div className="flex flex-wrap justify-center gap-3.5 max-w-2xl mx-auto py-2">
          {quickLinks.map((link) => {
            const LinkIcon = link.icon;
            return (
              <Link 
                key={link.title}
                href={link.href}
                className="group flex items-center gap-3 px-5 py-3.5 rounded-full border border-[#1f2528]/8 bg-white/75 hover:bg-white hover:border-[#2f7867]/30 hover:shadow-[0_8px_30px_rgba(47,120,103,0.04)] transition-all duration-300 shadow-sm cursor-pointer"
              >
                <div 
                  className="flex h-7 w-7 items-center justify-center rounded-full shrink-0"
                  style={{ backgroundColor: link.bgLight, color: link.color }}
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-bold text-[#1f2528] flex items-center gap-2">
                  {link.title}
                  <ArrowRight className="h-3.5 w-3.5 text-slate-300 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-[#2f7867]" />
                </span>
              </Link>
            );
          })}
        </div>

        {/* Primary and Secondary Navigation CTAs */}
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row max-w-sm mx-auto pt-4">
          <Link 
            href="/dashboard" 
            className="group inline-flex items-center justify-center w-full px-6 py-4 rounded-full bg-gradient-to-r from-[#2f7867] to-[#1d5b95] text-white text-xs font-bold uppercase tracking-wider transition-all duration-300 shadow-[0_8px_20px_rgba(47,120,103,0.12)] hover:shadow-[0_12px_24px_rgba(47,120,103,0.22)] hover:-translate-y-0.5 cursor-pointer"
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Go to dashboard
          </Link>
          <Link 
            href="/" 
            className="inline-flex items-center justify-center w-full px-6 py-4 rounded-full border border-[#1f2528]/15 bg-white text-[#1f2528] text-xs font-bold uppercase tracking-wider hover:bg-slate-50 hover:border-[#1f2528]/25 transition-all duration-300 shadow-sm cursor-pointer"
          >
            <Home className="mr-2 h-4 w-4 text-slate-400" />
            Back to home
          </Link>
        </div>

      </div>

    </main>
  );
}
