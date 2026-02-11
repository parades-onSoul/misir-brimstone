'use client';

import { Home, Layers, TrendingUp, Search, Settings, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useSpaces } from '@/lib/api/spaces';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getSpaceColor } from '@/lib/colors';
import { cn } from '@/lib/utils';

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { data: spacesData } = useSpaces(user?.id);
  const spaces = spacesData?.spaces || [];

  const mainNavItems = [
    { title: 'Home', url: '/dashboard', icon: Home },
    { title: 'Analytics', url: '/dashboard/analytics', icon: TrendingUp },
    { title: 'Search', url: '/dashboard/search', icon: Search },
    { title: 'Settings', url: '/dashboard/settings', icon: Settings },
  ];

  return (
    <Sidebar className="border-r border-white/5 bg-[#0B0C0E]">
      <SidebarHeader className="border-b border-white/5 h-14 px-4 flex items-center">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="size-6 rounded bg-linear-to-br from-[#5E6AD2] to-[#7C4DFF] flex items-center justify-center">
            <span className="text-white text-[12px] font-bold">M</span>
          </div>
          <span className="text-[15px] font-semibold text-[#EEEEF0]">Misir</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarMenu>
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.url;
              
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className={cn(
                      "text-[14px] hover:bg-white/5 transition-colors",
                      isActive && "bg-white/8 text-[#EEEEF0] font-medium"
                    )}
                  >
                    <Link href={item.url}>
                      <Icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        {/* Spaces Section */}
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="text-[13px] text-[#8A8F98] hover:text-[#EEEEF0] transition-colors flex items-center justify-between w-full group-data-[state=open]/collapsible:text-[#EEEEF0]">
                <div className="flex items-center gap-2">
                  <Layers className="size-3.5" />
                  <span>Spaces</span>
                  <span className="text-[11px] text-[#5F646D]">({spaces.length})</span>
                </div>
                <ChevronRight className="size-3.5 transition-transform group-data-[state=open]/collapsible:rotate-90" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarMenuSub>
                {spaces.length === 0 ? (
                  <SidebarMenuSubItem>
                    <div className="px-2 py-1.5 text-[12px] text-[#5F646D] italic">
                      No spaces yet
                    </div>
                  </SidebarMenuSubItem>
                ) : (
                  spaces.map((space, idx) => {
                    const color = getSpaceColor(idx);
                    const isActive = pathname === `/spaces/${space.id}`;
                    
                    return (
                      <SidebarMenuSubItem key={space.id}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={isActive}
                          className={cn(
                            "text-[13px] hover:bg-white/5 transition-colors",
                            isActive && "bg-white/8 text-[#EEEEF0] font-medium"
                          )}
                        >
                          <Link href={`/spaces/${space.id}`}>
                            <div 
                              className="size-2 rounded-full shrink-0"
                              style={{ backgroundColor: color.hex }}
                            />
                            <span className="truncate">{space.name}</span>
                            {space.artifact_count > 0 && (
                              <span className="ml-auto text-[11px] text-[#5F646D]">
                                {space.artifact_count}
                              </span>
                            )}
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    );
                  })
                )}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>

      <SidebarFooter className="border-t border-white/5 p-4">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-linear-to-br from-[#5E6AD2] to-[#7C4DFF] flex items-center justify-center shrink-0">
            <span className="text-white text-[13px] font-medium">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] text-[#EEEEF0] truncate">
              {user?.email || 'User'}
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

