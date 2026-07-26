"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sliders, Sparkles, TrendingUp, Clock, Landmark } from "lucide-react";

export function PricingVisual() {
  const [channelsCount, setChannelsCount] = useState(5);
  const [postsCount, setPostsCount] = useState(30);

  // ROI Math
  // 15 minutes saved formatting/optimizing per post per channel
  const totalMinutesSaved = channelsCount * postsCount * 15;
  const hoursSaved = Math.round((totalMinutesSaved / 60) * 10) / 10;
  
  // Design/formatting overhead worth ₹750/hour
  const estimatedSavings = Math.round(hoursSaved * 750);

  const getRecommendedPlan = () => {
    if (channelsCount <= 4 && postsCount <= 10) return "Starter";
    if (channelsCount <= 8 && postsCount <= 150) return "Pro";
    return "Plus";
  };

  return (
    <div className="relative mx-auto w-full max-w-[420px] p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] border border-[#1f2528]/8 bg-white/90 shadow-[0_24px_50px_rgba(0,0,0,0.035)] backdrop-blur-xl flex flex-col gap-5 sm:gap-6 text-left select-none overflow-hidden">
      
      {/* Visual Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-xs font-black text-[#1f2528] tracking-tight flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-[#2f7867]" /> ROI Calculator
          </h3>
          <span className="text-[9px] text-slate-450 font-bold uppercase tracking-wider mt-1 block">Calculate time & design savings</span>
        </div>
        <div className="flex items-center gap-1 bg-[#2f7867]/5 border border-[#2f7867]/10 text-[#2f7867] px-2 py-0.5 rounded-full text-[9px] font-black uppercase">
          Interactive
        </div>
      </div>

      {/* Sliders Block */}
      <div className="space-y-4">
        
        {/* Slider 1: Channels */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-bold text-[#1f2528]">
            <span>Social Channels</span>
            <span className="text-[#2f7867] font-black">{channelsCount} platforms</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={channelsCount}
            onChange={(e) => setChannelsCount(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#2f7867]"
          />
        </div>

        {/* Slider 2: Posts */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-bold text-[#1f2528]">
            <span>Posts per Month</span>
            <span className="text-[#2f7867] font-black">{postsCount} drafts</span>
          </div>
          <input
            type="range"
            min="5"
            max="150"
            step="5"
            value={postsCount}
            onChange={(e) => setPostsCount(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#2f7867]"
          />
        </div>

      </div>

      {/* ROI Display Panels */}
      <div className="grid grid-cols-2 gap-3 mt-2">
        <div className="p-3.5 rounded-2xl border border-slate-100 bg-[#fbfbf9]/60 flex flex-col justify-between">
          <div className="flex items-center gap-1 text-[8px] text-slate-450 font-bold uppercase tracking-wider">
            <Clock className="h-3.5 w-3.5 text-[#2f7867]" /> Time Saved
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-black text-[#1f2528] tracking-tight">{hoursSaved}</span>
            <span className="text-[10px] text-slate-400 font-bold ml-1">hrs/mo</span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl border border-slate-100 bg-[#fbfbf9]/60 flex flex-col justify-between">
          <div className="flex items-center gap-1 text-[8px] text-slate-450 font-bold uppercase tracking-wider">
            <Landmark className="h-3.5 w-3.5 text-[#2f7867]" /> Value Saved
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-black text-[#1f2528] tracking-tight">₹{estimatedSavings.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 font-bold ml-1">/mo</span>
          </div>
        </div>
      </div>

      {/* Recommendation Panel */}
      <motion.div
        layout
        className="p-4 rounded-2xl border border-[#2f7867]/15 bg-[#2f7867]/5 flex items-center justify-between"
      >
        <div>
          <span className="text-[8px] text-[#2f7867] font-black uppercase tracking-wider block">Recommended Tier</span>
          <h4 className="text-sm font-black text-[#1f2528] mt-0.5">{getRecommendedPlan()} Plan</h4>
        </div>
        <span className="text-[9px] text-[#2f7867] font-black uppercase bg-[#2f7867]/10 px-2.5 py-1 rounded-lg">
          Pays for itself
        </span>
      </motion.div>

      {/* Footer Sparkle */}
      <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[9px] text-slate-400 font-bold">
        <span className="flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-[#2f7867] fill-[#2f7867]/10" /> Maximize publishing output</span>
        <span>Postelligence ROI</span>
      </div>

    </div>
  );
}
