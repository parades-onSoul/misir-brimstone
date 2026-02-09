'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Layers, Compass, Plus, ChevronRight } from 'lucide-react';
import { useUIStore, useSpaceStore, useAuthStore } from '@/lib/store';

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarRail,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// Navigation items (excluding Spaces since it will be collapsible)
const navItems = [
    {
        title: 'Report',
        url: '/dashboard/report',
        icon: FileText,
    },
];

export function AppSidebar() {
    const pathname = usePathname();
    const { setCreateSpaceModalOpen } = useUIStore();
    const { spaces, setSpaces, setLoading } = useSpaceStore();
    const { user } = useAuthStore();

    // Fetch spaces on mount
    useEffect(() => {
        async function fetchSpaces() {
            if (!user) return;

            try {
                setLoading(true);
                const response = await fetch('/api/spaces');
                if (response.ok) {
                    const data = await response.json();
                    setSpaces(data.spaces || []);
                }
            } catch (error) {
                console.error('Error fetching spaces:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchSpaces();
    }, [user, setSpaces, setLoading]);

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/dashboard">
                                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                                    <Compass className="size-4" />
                                </div>
                                <div className="flex flex-col gap-0.5 leading-none">
                                    <span className="font-semibold">Misir</span>
                                    <span className="text-xs text-muted-foreground">Personal Orientation</span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                {/* New Space Button */}
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    onClick={() => setCreateSpaceModalOpen(true)}
                                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                                    tooltip="Create new space"
                                >
                                    <Plus />
                                    <span>New Space</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* Navigation Items */}
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navItems.map((item) => {
                                const isActive = pathname.startsWith(item.url);
                                return (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                                            <Link href={item.url}>
                                                <item.icon />
                                                <span>{item.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* Spaces with nested sub-pages */}
                <SidebarGroup>
                    <SidebarGroupLabel>Spaces</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {spaces.length === 0 ? (
                                <SidebarMenuItem>
                                    <SidebarMenuButton disabled>
                                        <span className="text-xs text-muted-foreground">No spaces yet</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ) : (
                                spaces.map((space) => (
                                    <Collapsible key={space.id} className="group/collapsible">
                                        <SidebarMenuItem>
                                            <CollapsibleTrigger asChild>
                                                <SidebarMenuButton tooltip={space.name}>
                                                    <Layers className="h-4 w-4" />
                                                    <span className="truncate">{space.name}</span>
                                                    <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                                                </SidebarMenuButton>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                                <SidebarMenuSub>
                                                    <SidebarMenuSubItem>
                                                        <SidebarMenuSubButton
                                                            asChild
                                                            isActive={pathname === `/dashboard/spaces/${space.id}`}
                                                        >
                                                            <Link href={`/dashboard/spaces/${space.id}`}>
                                                                <span>Overview</span>
                                                            </Link>
                                                        </SidebarMenuSubButton>
                                                    </SidebarMenuSubItem>
                                                    <SidebarMenuSubItem>
                                                        <SidebarMenuSubButton
                                                            asChild
                                                            isActive={pathname === `/dashboard/spaces/${space.id}/artifacts`}
                                                        >
                                                            <Link href={`/dashboard/spaces/${space.id}/artifacts`}>
                                                                <span>Artifacts</span>
                                                            </Link>
                                                        </SidebarMenuSubButton>
                                                    </SidebarMenuSubItem>
                                                    <SidebarMenuSubItem>
                                                        <SidebarMenuSubButton
                                                            asChild
                                                            isActive={pathname === `/dashboard/spaces/${space.id}/configuration`}
                                                        >
                                                            <Link href={`/dashboard/spaces/${space.id}/configuration`}>
                                                                <span>Configuration</span>
                                                            </Link>
                                                        </SidebarMenuSubButton>
                                                    </SidebarMenuSubItem>
                                                </SidebarMenuSub>
                                            </CollapsibleContent>
                                        </SidebarMenuItem>
                                    </Collapsible>
                                ))
                            )}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="sm" className="text-muted-foreground">
                            <span className="text-xs">v0.1.0</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    );
}
