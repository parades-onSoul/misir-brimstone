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
  <div className="h-12 flex items-center px-4 mb-2 border-b border-sidebar-border">
    <div className="flex items-center gap-2.5 text-sidebar-foreground">
      {/* Brand Icon (Static, with glow) */}
      <div className="size-5 bg-primary rounded flex items-center justify-center shadow-[0_0_10px_rgba(94,106,210,0.4)]">
        <svg
          className="w-3 h-3 text-primary-foreground"
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
    className="flex items-center gap-2.5 px-3 h-8 w-full text-left rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors group"
  >
    <Icon
      className="size-3.75 opacity-70 group-hover:opacity-100"
      strokeWidth={1.5}
    />
    <span className="text-[13px] font-medium flex-1">{label}</span>
    {shortcut && (
      <kbd className="text-[10px] text-muted-foreground font-mono border border-border/20 px-1 rounded bg-muted/20">
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
    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
      {label}
    </span>
    {onAdd && (
      <button
        onClick={onAdd}
        className="text-muted-foreground hover:text-sidebar-foreground opacity-0 group-hover:opacity-100 transition-opacity"
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
        ? "text-sidebar-accent-foreground bg-sidebar-accent"
        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
    )}
  >
    <Icon
      className={cn(
        "size-3.75",
        active ? "text-primary" : "text-muted-foreground"
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
    <aside className="w-65 h-screen flex flex-col bg-sidebar/95 backdrop-blur-xl border-r border-sidebar-border">
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
            <div className="px-3 py-2 text-[13px] text-muted-foreground flex items-center gap-2">
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
      <div className="h-13 border-t border-white/5 flex items-center px-4 hover:bg-white/2 cursor-pointer transition-colors">
        <div className="size-6 rounded-full bg-linear-to-br from-purple-500 to-indigo-600 border border-white/10 mr-2.5" />
        <span className="text-[13px] font-medium text-[#EEEEF0] truncate max-w-35">
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
