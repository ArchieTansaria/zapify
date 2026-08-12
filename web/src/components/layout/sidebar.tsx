'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Workflow, Activity, Users, Settings } from "lucide-react"

import { cn } from "@/lib/utils"
import { OrganizationSelector } from "./organization-selector"
import { UserMenu } from "./user-menu"

import { ZapifyLogo } from "@/components/brand/zapify-logo"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

const routes = [
  {
    label: "Workspace",
    items: [
      { name: "Overview", href: "/app", icon: LayoutDashboard },
      { name: "Workflows", href: "/app/workflows", icon: Workflow },
      { name: "Runs", href: "/app/runs", icon: Activity },
    ],
  },
  {
    label: "Organization",
    items: [
      { name: "Members", href: "/app/members", icon: Users },
      { name: "Settings", href: "/app/settings", icon: Settings },
    ],
  },
]

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ isCollapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col border-r bg-background">
      <div className="flex h-14 items-center justify-between border-b px-4">
        {!isCollapsed ? (
          <>
            <Link href="/app" className="flex items-center gap-2 font-semibold hover:opacity-80 transition-opacity">
              <ZapifyLogo />
            </Link>
            <button
              onClick={onToggle}
              className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            onClick={onToggle}
            className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
      </div>
      
      <div className="flex-1 overflow-auto py-4">
        <nav className="space-y-6 px-4">
          {routes.map((group) => (
            <div key={group.label}>
              {!isCollapsed && (
                <h4 className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </h4>
              )}
              {isCollapsed && <div className="h-4" />}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={isCollapsed ? item.name : undefined}
                      className={cn(
                        "flex items-center rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring",
                        isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                        isCollapsed ? "justify-center" : "gap-3"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!isCollapsed && <span>{item.name}</span>}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {!isCollapsed && (
        <div className="mt-auto border-t p-4 space-y-4">
          <OrganizationSelector />
          <UserMenu />
        </div>
      )}
    </div>
  )
}
