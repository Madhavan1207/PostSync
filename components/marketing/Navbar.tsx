"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/marketing/BrandMark";

const links = [
  { href: "/features", label: "Features" },
  { href: "/platforms", label: "Integrations" },
  { href: "/pricing", label: "Pricing" },
  { href: "/changelog", label: "Changelog" },
  { href: "/about", label: "About" }
];

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Collapse the mobile menu whenever the route changes. Adjusting state
  // during render (rather than in an effect) avoids the extra render pass
  // that would briefly paint the menu open on the new page.
  const [renderedPathname, setRenderedPathname] = useState(pathname);
  if (renderedPathname !== pathname) {
    setRenderedPathname(pathname);
    setOpen(false);
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 pt-4 md:px-6">
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between rounded-2xl border px-4 py-3 transition-all duration-300 md:px-5 ${
          scrolled
            ? "border-[#1f2528]/8 bg-white/50 shadow-[0_12px_40px_rgba(31,37,40,0.06)] backdrop-blur-xl"
            : "border-transparent bg-white/20 backdrop-blur-md"
        }`}
      >
        <Link href="/" className="shrink-0">
          <BrandMark size="sm" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <a
                key={link.href}
                href={link.href}
                className={`relative rounded-full px-3.5 py-2 text-[0.88rem] font-medium transition-colors ${
                  active ? "text-[#1f2528]" : "text-[#5a656c] hover:text-[#1f2528]"
                }`}
              >
                {active ? (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-[#1f2528]/[0.06]"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                ) : null}
                <span className="relative">{link.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <a
            href="/login"
            className="rounded-full px-4 py-2 text-[0.88rem] font-semibold text-[#3a444a] transition hover:text-[#1f2528]"
          >
            Sign in
          </a>
          <a href="/login" className="marketing-cta-primary !min-h-0 !py-2.5 !text-[0.86rem]">
            Get started
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#1f2528] md:hidden"
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-2 max-w-6xl max-h-[85dvh] overflow-y-auto rounded-2xl border border-[#1f2528]/10 bg-white/95 p-3 shadow-[0_12px_40px_rgba(31,37,40,0.12)] backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-xl px-3 py-3 text-[0.95rem] font-medium text-[#3a444a] transition hover:bg-[#1f2528]/[0.05] hover:text-[#1f2528]"
                >
                  {link.label}
                </a>
              ))}
              <div className="my-2 h-px bg-[#1f2528]/8" />
              <a
                href="/login"
                className="rounded-xl px-3 py-3 text-[0.95rem] font-semibold text-[#3a444a]"
              >
                Sign in
              </a>
              <a
                href="/login"
                className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-[#1f2528] px-4 py-3 text-[0.95rem] font-bold text-white shadow-md cursor-pointer transition hover:bg-[#2b353b]"
              >
                <span>Get started</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-white" />
              </a>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
