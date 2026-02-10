"use client";

/**
 * AppSidebar - Linear Edition
 * 
 * The primary navigation hub with:
 * - Static brand header (no dropdown)
 * - Global actions (Search, New Topic)
 * - Insights section (Analytics, Reports)
 * - Spaces section (collapsible list)
 * - User profile footer
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  PlusSquare,
  BarChart2,
  FileText,
  Layers,
  Hash,
  Settings,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useSpaces } from "@/lib/api/spaces";
import { useUIStore } from "@/lib/stores/ui";

// --- Sub-Components ---

const SidebarHeader = () => (
  <div className="h-12 flex items-center px-4 mb-2 border-b border-white/5">
    <div className="flex items-center gap-2.5 text-[#EEEEF0]">
      {/* Brand Icon (Static, with glow) */}
      <div className="size-5 bg-[#5E6AD2] rounded flex items-center justify-center shadow-[0_0_10px_rgba(94,106,210,0.4)]">
        <svg
          className="w-3 h-3 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      </div>
      <span className="text-[14px] font-semibold tracking-tight">Misir</span>
    </div>
  </div>
);

interface SidebarActionProps {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  shortcut?: string;
  onClick?: () => void;
}

const SidebarAction = ({
  icon: Icon,
  label,
  shortcut,
  onClick,
}: SidebarActionProps) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2.5 px-3 h-8 w-full text-left rounded-md text-[#8A8F98] hover:bg-white/[0.04] hover:text-[#EEEEF0] transition-colors group"
  >
    <Icon
      className="size-[15px] opacity-70 group-hover:opacity-100"
      strokeWidth={1.5}
    />
    <span className="text-[13px] font-medium flex-1">{label}</span>
    {shortcut && (
      <kbd className="text-[10px] text-[#5F646D] font-mono border border-white/10 px-1 rounded bg-white/[0.02]">
        {shortcut}
      </kbd>
    )}
  </button>
);

interface SectionHeaderProps {
  label: string;
  onAdd?: () => void;
}

const SectionHeader = ({ label, onAdd }: SectionHeaderProps) => (
  <div className="flex items-center justify-between mt-6 mb-1 px-3 group">
    <span className="text-[11px] font-medium text-[#5F646D] uppercase tracking-wider">
      {label}
    </span>
    {onAdd && (
      <button
        onClick={onAdd}
        className="text-[#5F646D] hover:text-[#EEEEF0] opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <PlusSquare className="size-3" strokeWidth={1.5} />
      </button>
    )}
  </div>
);

interface NavItemProps {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  href: string;
  active?: boolean;
}

const NavItem = ({ icon: Icon, label, href, active }: NavItemProps) => (
  <Link
    href={href}
    className={cn(
      "flex items-center gap-2.5 px-3 h-7 rounded-md transition-all duration-150",
      active
        ? "text-[#EEEEF0] bg-white/[0.06]"
        : "text-[#8A8F98] hover:bg-white/[0.04] hover:text-[#EEEEF0]"
    )}
  >
    <Icon
      className={cn(
        "size-[15px]",
        active ? "text-[#5E6AD2]" : "text-[#5F646D]"
      )}
      strokeWidth={1.5}
    />
    <span className="text-[13px] font-medium">{label}</span>
  </Link>
);

// --- Main Sidebar Component ---

export const AppSidebar = () => {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const { data, isLoading: spacesLoading } = useSpaces(user?.id);
  const { openCreateSpaceModal } = useUIStore();
  const spaces = data?.spaces ?? [];
  const isLoading = authLoading || spacesLoading;

  const isActive = (path: string) => pathname === path;

  return (
    <aside className="w-[260px] h-screen flex flex-col bg-[#0B0C0E]/95 backdrop-blur-xl border-r border-white/5">
      {/* 1. Static Header */}
      <SidebarHeader />

      <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-hide">
        {/* 2. Global Actions */}
        <div className="space-y-0.5">
          <SidebarAction
            icon={Search}
            label="Search"
            shortcut="⌘K"
            onClick={() => {
              /* Open command palette */
            }}
          />
          <SidebarAction
            icon={PlusSquare}
            label="New Topic"
            shortcut="C"
            onClick={openCreateSpaceModal}
          />
        </div>

        {/* 3. Section: Insights */}
        <SectionHeader label="Insights" />
        <div className="space-y-0.5">
          <NavItem
            icon={BarChart2}
            label="Analytics"
            href="/dashboard/analytics"
            active={isActive("/dashboard/analytics")}
          />
          <NavItem
            icon={FileText}
            label="Weekly Report"
            href="/dashboard/report"
            active={isActive("/dashboard/report")}
          />
        </div>

        {/* 4. Section: Spaces */}
        <SectionHeader 
          label="Spaces" 
          onAdd={openCreateSpaceModal} 
        />
        <div className="space-y-0.5">
          {isLoading ? (
            <div className="px-3 py-2 text-[13px] text-[#5F646D] flex items-center gap-2">
              <Loader2 className="size-3 animate-spin" />
              <span>Loading spaces...</span>
            </div>
          ) : spaces.length > 0 ? (
            <>
              {spaces.map((space) => (
                <NavItem 
                  key={space.id}
                  icon={Hash} 
                  label={space.name} 
                  href={`/dashboard/spaces/${space.id}`}
                  active={isActive(`/dashboard/spaces/${space.id}`)}
                />
              ))}
              <NavItem 
                icon={Layers} 
                label="All Spaces" 
                href="/dashboard/spaces" 
                active={isActive("/dashboard/spaces")}
              />
            </>
          ) : (
            <div className="px-3 py-2 text-[13px] text-[#5F646D] italic">
              No spaces yet
            </div>
          )}
        </div>
      </div>

      {/* 5. Footer: User Profile */}
      <div className="h-[52px] border-t border-white/5 flex items-center px-4 hover:bg-white/[0.02] cursor-pointer transition-colors">
        <div className="size-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 border border-white/10 mr-2.5" />
        <span className="text-[13px] font-medium text-[#EEEEF0] truncate max-w-[140px]">
          {user?.user_metadata?.full_name || user?.email || 'User'}
        </span>
        <Settings
          className="ml-auto size-3.5 text-[#5F646D]"
          strokeWidth={1.5}
        />
      </div>
    </aside>
  );
};
