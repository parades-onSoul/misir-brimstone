"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import {
  FileText,
  Layers,
  Compass,
  Plus,
  ChevronRight,
} from "lucide-react"

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
  useSidebar,
} from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useAuth } from "@/hooks/use-auth"
import { useUIStore } from "@/lib/stores/ui"
import { useSpaces } from "@/lib/api/spaces"

const navItems = [
  {
    title: "Report",
    url: "/dashboard/report",
    icon: FileText,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { openCreateSpaceModal } = useUIStore()
  const { user } = useAuth()
  const { data, isLoading } = useSpaces(user?.id)
  const spaces = data?.spaces ?? []
  const { state } = useSidebar()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Compass className="size-4" />
                </div>
                <div className={state === "collapsed" ? "sr-only" : "flex flex-col gap-0.5 leading-none"}>
                  <span className="font-semibold">Misir</span>
                  <span className="text-xs text-muted-foreground">Personal Orientation</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={openCreateSpaceModal}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  tooltip="Create new space"
                  size={state === "collapsed" ? "sm" : "default"}
                >
                  <Plus className="!size-4" />
                  <span className={state === "collapsed" ? "sr-only" : ""}>New Space</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.url)
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      size={state === "collapsed" ? "sm" : "default"}
                    >
                      <Link href={item.url}>
                        <item.icon className="!size-4" />
                        <span className={state === "collapsed" ? "sr-only" : ""}>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className={state === "collapsed" ? "sr-only" : ""}>Spaces</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading ? (
                <SidebarMenuItem>
                  <SidebarMenuButton size={state === "collapsed" ? "sm" : "default"} disabled>
                    <span className={state === "collapsed" ? "sr-only" : "text-xs text-muted-foreground"}>Loading spaces…</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : spaces.length === 0 ? (
                <SidebarMenuItem>
                  <SidebarMenuButton size={state === "collapsed" ? "sm" : "default"} disabled>
                    <span className={state === "collapsed" ? "sr-only" : "text-xs text-muted-foreground"}>No spaces yet</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : (
                spaces.map((space) => {
                  const basePath = `/dashboard/spaces/${space.id}`
                  const isBase = pathname === basePath
                  const tab = searchParams.get("tab")

                  return (
                    <Collapsible key={space.id} className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton tooltip={space.name} size={state === "collapsed" ? "sm" : "default"}>
                            <Layers className="h-4 w-4" />
                            <span className={state === "collapsed" ? "sr-only" : "truncate"}>{space.name}</span>
                            <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton
                                asChild
                                isActive={isBase && tab !== "artifacts"}
                              >
                                <Link href={basePath}>
                                  <span>Overview</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton
                                asChild
                                isActive={isBase && tab === "artifacts"}
                              >
                                <Link href={`${basePath}?tab=artifacts`}>
                                  <span>Artifacts</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton
                                asChild
                                isActive={pathname === `${basePath}/configuration`}
                              >
                                <Link href={`${basePath}/configuration`}>
                                  <span>Configuration</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  )
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size={state === "collapsed" ? "sm" : "default"} className="text-muted-foreground">
              <span className={state === "collapsed" ? "sr-only" : "text-xs"}>v0.1.0</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

