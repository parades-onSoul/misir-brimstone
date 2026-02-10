"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import {
  FileText,
  Layers,
  Plus,
  ChevronRight,
  Sparkles,
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
    <Sidebar collapsible="icon" {...props} className="border-r border-border/40">
      <SidebarHeader className="border-b border-border/40 px-3 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="notion-hover rounded-md">
              <Link href="/dashboard">
                <div className="flex aspect-square size-7 items-center justify-center rounded-md bg-gradient-to-br from-primary/90 to-primary text-primary-foreground">
                  <Sparkles className="size-3.5" />
                </div>
                <div className={state === "collapsed" ? "sr-only" : "flex flex-col gap-0 leading-tight"}>
                  <span className="font-semibold text-[15px]">Misir</span>
                  <span className="text-[11px] text-muted-foreground">Orientation System</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={openCreateSpaceModal}
                  className="notion-hover text-foreground font-medium h-8"
                  tooltip="Create new space"
                  size={state === "collapsed" ? "sm" : "default"}
                >
                  <div className="flex items-center justify-center size-5 rounded bg-primary/10 text-primary">
                    <Plus className="!size-3.5" />
                  </div>
                  <span className={state === "collapsed" ? "sr-only" : "text-sm"}>New Space</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-1">
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
                      className={`notion-hover h-8 ${isActive ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="!size-4" />
                        <span className={state === "collapsed" ? "sr-only" : "text-sm"}>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className={state === "collapsed" ? "sr-only" : "text-[11px] font-medium text-muted-foreground px-2 py-1"}>
            Spaces
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading ? (
                <SidebarMenuItem>
                  <SidebarMenuButton size={state === "collapsed" ? "sm" : "default"} disabled className="h-8">
                    <span className={state === "collapsed" ? "sr-only" : "text-xs text-muted-foreground"}>Loading...</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : spaces.length === 0 ? (
                <SidebarMenuItem>
                  <SidebarMenuButton size={state === "collapsed" ? "sm" : "default"} disabled className="h-8">
                    <span className={state === "collapsed" ? "sr-only" : "text-xs text-muted-foreground italic"}>No spaces yet</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : (
                spaces.map((space) => {
                  const basePath = `/dashboard/spaces/${space.id}`
                  const isBase = pathname === basePath
                  const tab = searchParams.get("tab")
                  const isSpaceActive = pathname.startsWith(basePath)

                  return (
                    <Collapsible key={space.id} className="group/collapsible" defaultOpen={isSpaceActive}>
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton 
                            tooltip={space.name} 
                            size={state === "collapsed" ? "sm" : "default"}
                            className={`notion-hover h-8 ${isSpaceActive ? 'bg-muted/50 text-foreground font-medium' : 'text-muted-foreground'}`}
                          >
                            <Layers className="h-4 w-4" />
                            <span className={state === "collapsed" ? "sr-only" : "truncate text-sm"}>{space.name}</span>
                            <ChevronRight className="ml-auto h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="transition-all duration-200">
                          <SidebarMenuSub className="ml-4 border-l border-border/40 pl-2 py-1">
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton
                                asChild
                                isActive={isBase && tab !== "artifacts"}
                                className={`notion-hover h-7 text-[13px] ${isBase && tab !== "artifacts" ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
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
                                className={`notion-hover h-7 text-[13px] ${isBase && tab === "artifacts" ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
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
                                className={`notion-hover h-7 text-[13px] ${pathname === `${basePath}/configuration` ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
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

      <SidebarFooter className="border-t border-border/40 px-3 py-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size={state === "collapsed" ? "sm" : "default"} className="notion-hover h-7">
              <span className={state === "collapsed" ? "sr-only" : "text-[11px] text-muted-foreground"}>v1.0.0 • shiro.exe</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

