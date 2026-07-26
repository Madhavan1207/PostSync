"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const words = ["Everywhere.", "on LinkedIn.", "on Instagram.", "on YouTube.", "on Threads."];

const brandGradients: Record<string, string> = {
  "Everywhere.": "bg-gradient-to-r from-[#2f7867] via-[#56a98f] to-[#d05945]",
  "on LinkedIn.": "bg-gradient-to-r from-[#0077B5] to-[#00a0dc]",
  "on Instagram.": "bg-gradient-to-r from-[#fdf497] via-[#fd5949] to-[#d6249f]",
  "on YouTube.": "bg-gradient-to-r from-[#FF0000] to-[#e60000]",
  "on Threads.": "bg-gradient-to-r from-[#1f2528] to-[#627078]"
};

export function RotatingWord() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % words.length);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="relative inline-grid align-baseline overflow-visible text-left max-w-full" style={{ perspective: 1000 }}>
      <AnimatePresence mode="wait">
        <motion.span
          key={words[index]}
          initial={{ rotateX: 60, y: 12, opacity: 0 }}
          animate={{ rotateX: 0, y: 0, opacity: 1 }}
          exit={{ rotateX: -60, y: -12, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className={`col-start-1 row-start-1 ${brandGradients[words[index]] || "text-[#1f2528]"} bg-clip-text text-transparent font-extrabold whitespace-nowrap pr-2 sm:pr-4 pl-0.5 pt-1 pb-2 origin-left`}
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
