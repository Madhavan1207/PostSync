"use client";

import { motion } from "framer-motion";
import { BrandMark } from "./BrandMark";

// Real Social Media Logos (Custom inline SVGs)
function LinkedInLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="#0077B5">
      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
    </svg>
  );
}

// Custom real SVG logo for Instagram (uses gradient fill)
function InstagramLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="url(#ig-grad-large)">
      <defs>
        <radialGradient id="ig-grad-large" cx="30%" cy="107%" r="130%">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="5%" stopColor="#fdf497" />
          <stop offset="45%" stopColor="#fd5949" />
          <stop offset="60%" stopColor="#d6249f" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0 3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845a1.21 1.21 0 1 0 .001 2.42 1.21 1.21 0 0 0-.001-2.42z" />
    </svg>
  );
}

function YouTubeLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="#FF0000">
      <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.508 9.388.508 9.388.508s7.518 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function ThreadsLogo() {
  return (
    <svg viewBox="0 0 16 16" className="h-8 w-8" fill="#000000">
      <path d="M6.321 6.016c-.27-.18-1.166-.802-1.166-.802.756-1.081 1.753-1.502 3.132-1.502.975 0 1.803.327 2.394.948s.928 1.509 1.005 2.644q.492.207.905.484c1.109.745 1.719 1.86 1.719 3.137 0 2.716-2.226 5.075-6.256 5.075C4.594 16 1 13.987 1 7.994 1 2.034 4.482 0 8.044 0 9.69 0 13.55.243 15 5.036l-1.36.353C12.516 1.974 10.163 1.43 8.006 1.43c-3.565 0-5.582 2.171-5.582 6.79 0 4.143 2.254 6.343 5.63 6.343 2.777 0 4.847-1.443 4.847-3.556 0-1.438-1.208-2.127-1.27-2.127-.236 1.234-.868 3.31-3.644 3.31-1.618 0-3.013-1.118-3.013-2.582 0-2.09 1.984-2.847 3.55-2.847.586 0 1.294.04 1.663.114 0-.637-.54-1.728-1.9-1.728-1.25 0-1.566.405-1.967.868ZM8.716 8.19c-2.04 0-2.304.87-2.304 1.416 0 .878 1.043 1.168 1.6 1.168 1.02 0 2.067-.282 2.232-2.423a6.2 6.2 0 0 0-1.528-.161"/>
    </svg>
  );
}

function FacebookLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function BlueskyLogo() {
  return (
    <svg viewBox="0 0 512 512" className="h-8 w-8" fill="#0085ff">
      <path d="M111.8 62.2C170.2 105.9 233 189.7 256 230c23-40.3 85.8-124.1 144.2-167.8C447.8 26.9 512 16 512 16s-10.9 64.2-46.2 111.8c-43.7 58.4-127.5 121.2-167.8 144.2 40.3 23 124.1 85.8 167.8 144.2 35.3 47.6 46.2 111.8 46.2 111.8s-64.2-10.9-111.8-46.2c-58.4-43.7-121.2-127.5-144.2-167.8-23 40.3-85.8 124.1-144.2 167.8C64.2 485.1 16 496 16 496s10.9-64.2 46.2-111.8c43.7-58.4 127.5-121.2 167.8-144.2-40.3-23-124.1-85.8-167.8-144.2C26.9 127.8 16 63.6 16 63.6s47.8 11.2 95.8 47.6z" />
    </svg>
  );
}

function PinterestLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="#BD081C">
      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.886 1.406-5.886s-.359-.722-.359-1.789c0-1.675.972-2.926 2.185-2.926 1.03 0 1.526.771 1.526 1.696 0 1.035-.658 2.585-.999 4.02-.283 1.2.603 2.18 1.784 2.18 2.143 0 3.791-2.261 3.791-5.524 0-2.887-2.076-4.908-5.04-4.908-3.433 0-5.449 2.572-5.449 5.234 0 1.037.4 2.146.9 2.753.1.12.115.228.085.349-.093.386-.299 1.209-.34 1.378-.053.223-.178.27-.41.163-1.529-.71-2.486-2.946-2.486-4.737 0-3.856 2.801-7.4 8.082-7.4 4.244 0 7.543 3.023 7.543 7.067 0 4.215-2.657 7.607-6.349 7.607-1.24 0-2.407-.645-2.806-1.406l-.762 2.906c-.276 1.052-1.022 2.37-1.522 3.187 1.125.347 2.316.537 3.551.537 6.621 0 11.986-5.37 11.986-11.988C24.014 5.367 18.647 0 12.017 0z" />
    </svg>
  );
}

function DiscordLogo() {
  return (
    <svg viewBox="0 0 127.14 96.36" className="h-8 w-8" fill="#5865F2">
      <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c.9-.65,1.76-1.34,2.58-2a75.58,75.58,0,0,0,72.77,0c.82.71,1.68,1.4,2.58,2a68.43,68.43,0,0,1-10.5,5,77.7,77.7,0,0,0,6.63,10.85,105.73,105.73,0,0,0,31.56-18.83C129.18,48.51,123.38,25.75,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z" />
    </svg>
  );
}

function XLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="#000000">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function HomeHeroVisual() {
  const platforms = [
    { name: "LinkedIn", color: "#1d5b95", bg: "#e8f1fb", initialAngle: 0, logo: LinkedInLogo },
    { name: "Instagram", color: "#a53b28", bg: "#fff0ed", initialAngle: 40, logo: InstagramLogo },
    { name: "YouTube", color: "#FF0000", bg: "#fff5d7", initialAngle: 80, logo: YouTubeLogo },
    { name: "Threads", color: "#000000", bg: "#eceeec", initialAngle: 120, logo: ThreadsLogo },
    { name: "Facebook", color: "#1877F2", bg: "#e7f3ff", initialAngle: 160, logo: FacebookLogo },
    { name: "Bluesky", color: "#0085ff", bg: "#e7f3fb", initialAngle: 200, logo: BlueskyLogo },
    { name: "Pinterest", color: "#BD081C", bg: "#fbe9ee", initialAngle: 240, logo: PinterestLogo },
    { name: "Discord", color: "#5865F2", bg: "#eef0fc", initialAngle: 280, logo: DiscordLogo },
    { name: "X", color: "#000000", bg: "#eceeec", initialAngle: 320, logo: XLogo },
  ];

  return (
    <div className="relative mx-auto w-[580px] h-[580px] shrink-0 flex items-center justify-center select-none transform-gpu">
      
      {/* Central Core: Postelligence BrandMark */}
      <motion.div
        animate={{ 
          y: [0, -4, 0]
        }}
        transition={{ 
          duration: 4, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
        className="relative z-20 flex h-28 w-28 items-center justify-center rounded-3xl bg-white border border-[#1f2528]/10 shadow-[0_16px_40px_rgba(47,120,103,0.12)] scale-105"
      >
        <BrandMark size="md" />
        <div className="absolute -inset-1 rounded-3xl bg-[#2f7867]/5 blur-md -z-10 animate-pulse" />
      </motion.div>

      {/* Solid Circular Orbit Line */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <div className="h-[440px] w-[440px] rounded-full border border-[#1f2528]/8" />
      </div>

      {/* Orbiting Platform Nodes */}
      {platforms.map((p, idx) => {
        const Logo = p.logo;
        return (
          <motion.div
            key={p.name}
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              left: 0,
              top: 0,
              transformOrigin: "center center",
              rotate: p.initialAngle
            }}
            animate={{ rotate: p.initialAngle + 360 }}
            transition={{
              repeat: Infinity,
              duration: 28,
              ease: "linear"
            }}
          >
            {/* Counter-rotating platform badge */}
            <motion.div
              style={{
                position: "absolute",
                left: "calc(50% - 40px)",
                top: "38px", // places node exactly on the 440px diameter circle radius!
                transformOrigin: "center center",
                rotate: -p.initialAngle
              }}
              animate={{ rotate: -(p.initialAngle + 360) }}
              transition={{
                repeat: Infinity,
                duration: 28,
                ease: "linear"
              }}
              className="z-25 flex h-20 w-20 items-center justify-center rounded-[24px] bg-white border border-[#1f2528]/8 shadow-[0_8px_20px_rgba(0,0,0,0.04)] cursor-default transition-all"
            >
              <Logo />
            </motion.div>
          </motion.div>
        );
      })}

      {/* Floating Sparkles decorative */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        className="absolute inset-10 border border-dashed border-[#2f7867]/5 rounded-full pointer-events-none"
      />

    </div>
  );
}
