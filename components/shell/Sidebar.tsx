"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  PenTool,
  FileText,
  Calendar,
  Image as ImageIcon,
  Sparkles,
  BarChart3,
  Link2,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Cpu,
  Users,
  LifeBuoy
} from "lucide-react";
import { BrandMark } from "@/components/marketing/BrandMark";
import { createClient } from "@/lib/supabase/client";

interface SidebarProps {
  user: {
    email?: string | null;
    user_metadata?: { full_name?: string; avatar_url?: string; name?: string };
  };
  open: boolean;
  onToggle: () => void;
  workspaceName?: string | null;
}

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/create", label: "Compose", icon: PenTool },
  { href: "/drafts", label: "Drafts", icon: FileText },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/library", label: "Library", icon: ImageIcon },
  { href: "/ai-studio", label: "AI Studio", icon: Sparkles },
  { href: "/automation", label: "Automation", icon: Cpu },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/integrations", label: "Integrations", icon: Link2 },
  { href: "/team", label: "Team", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/support", label: "Support", icon: LifeBuoy }
];

export default function Sidebar({ user, open, onToggle, workspaceName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  // Remember which avatar URL failed to load rather than a bare boolean, so
  // switching to a different avatar re-attempts it automatically — no effect
  // needed to reset the flag.
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const avatarUrl = user?.user_metadata?.avatar_url;
  const avatarError = avatarUrl != null && failedAvatarUrl === avatarUrl;

  const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Creator";
  const initials = name.slice(0, 2).toUpperCase();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-[#1f2528]/30 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onToggle}
        />
      )}

      <aside
        className={`fixed bottom-4 left-4 top-4 z-50 flex flex-col rounded-[24px] border border-[#1f2528]/12 bg-white/95 p-4 transition-all duration-300 backdrop-blur-md shadow-[0_12px_40px_rgba(31,37,40,0.14)] ${
          open
            ? "translate-x-0 w-[240px]"
            : "-translate-x-[calc(100%+24px)] lg:translate-x-0 lg:w-[76px]"
        }`}
      >
        {/* Brand Header */}
        <div className={`flex h-12 items-center px-1 ${open ? "justify-start" : "justify-center"}`}>
          <Link href="/dashboard" className="flex items-center overflow-hidden">
            <BrandMark size="sm" hideText={!open} />
          </Link>
        </div>

        {/* Scrollable Navigation */}
        <nav 
          className="mt-6 flex-1 overflow-y-auto space-y-1 pr-1"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(31, 37, 40, 0.12) transparent" }}
        >
          <style dangerouslySetInnerHTML={{__html: `
            nav::-webkit-scrollbar {
              width: 4px;
            }
            nav::-webkit-scrollbar-track {
              background: transparent;
              margin-top: 4px;
              margin-bottom: 4px;
            }
            nav::-webkit-scrollbar-thumb {
              background: rgba(31, 37, 40, 0.12);
              border-radius: 99px;
            }
            nav::-webkit-scrollbar-thumb:hover {
              background: rgba(47, 120, 103, 0.3);
            }
          `}} />
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => {
                  if (typeof window !== "undefined" && window.innerWidth < 1024) {
                    onToggle();
                  }
                }}
                className={`flex items-center transition-colors duration-150 rounded-xl text-sm font-semibold ${
                  open ? "px-3 py-2.5 gap-3.5 w-full" : "justify-center px-0 h-11 w-11 mx-auto"
                } ${
                  isActive
                    ? "bg-[#2f7867]/10 text-[#2f7867]"
                    : "text-[#5a656c] hover:bg-[#f4f6f0] hover:text-[#1f2528]"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {open && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

      {/* Fixed Bottom Section (Toggle + User Profile Footer) */}
      <div className="mt-auto pt-4 border-t border-[#1f2528]/8 flex flex-col gap-4">
        {/* Sidebar Collapse Toggle Button */}
        <button
          onClick={onToggle}
          className={`flex items-center transition-colors duration-150 rounded-xl text-sm font-semibold border border-[#1f2528]/8 text-[#5a656c] hover:bg-[#f4f6f0] hover:text-[#1f2528] cursor-pointer ${
            open ? "px-3 py-2.5 gap-3.5 w-full" : "justify-center px-0 h-11 w-11 mx-auto"
          }`}
          title={open ? "Collapse sidebar" : "Expand sidebar"}
        >
          {open ? (
            <>
              <ChevronLeft className="h-5 w-5 shrink-0" />
              <span className="truncate">Collapse Sidebar</span>
            </>
          ) : (
            <ChevronRight className="h-5 w-5 shrink-0" />
          )}
        </button>

        {/* User Footer */}
        <div className="relative">
          {/* Floating User Popover Menu */}
          {showUserMenu && (
            <div className="absolute bottom-full mb-2 left-0 z-50 w-56 rounded-2xl border border-[#1f2528]/8 bg-white p-2 shadow-[0_12px_32px_rgba(31,37,40,0.12)]">
              <div className="px-2.5 py-2 mb-1.5 border-b border-[#1f2528]/6">
                <p className="truncate text-xs font-bold text-[#1f2528]">{name}</p>
                <p className="truncate text-[10px] text-[#5a656c] mt-0.5">{user?.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2.5 text-[#a53b28] hover:bg-rose-500/10 hover:text-[#a53b28] rounded-xl px-2.5 py-2 text-xs font-semibold cursor-pointer w-full transition-colors"
                title="Sign out"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Sign out</span>
              </button>
            </div>
          )}

          <div
            onClick={() => setShowUserMenu(!showUserMenu)}
            className={`flex items-center cursor-pointer hover:bg-[#f4f6f0] p-1 rounded-xl transition-colors ${
              open ? "gap-3 px-1" : "justify-center px-0"
            }`}
          >
            {user?.user_metadata?.avatar_url && !avatarError ? (
              <img
                src={user.user_metadata.avatar_url}
                alt={name}
                className="h-9 w-9 rounded-full object-cover border border-[#1f2528]/12 shrink-0"
                onError={() => setFailedAvatarUrl(user.user_metadata!.avatar_url ?? null)}
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2f7867]/10 text-xs font-bold text-[#2f7867] border border-[#2f7867]/20">
                {initials}
              </div>
            )}
            {open && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#1f2528]">{name}</p>
                <p className="truncate text-xs text-[#5a656c]">{user?.email}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  </>
  );
}
