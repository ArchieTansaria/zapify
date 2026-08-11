'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Workflow, Activity, Users, Settings } from "lucide-react"

import { cn } from "@/lib/utils"
import { OrganizationSelector } from "./organization-selector"
import { UserMenu } from "./user-menu"

import { ZapifyLogo } from "@/components/brand/zapify-logo"

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

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col border-r bg-background">
      <div className="flex h-14 items-center border-b px-6">
        <Link href="/app" className="flex items-center gap-2 font-semibold hover:opacity-80 transition-opacity">
          <ZapifyLogo />
        </Link>
      </div>
      
      <div className="flex-1 overflow-auto py-4">
        <nav className="space-y-6 px-4">
          {routes.map((group) => (
            <div key={group.label}>
              <h4 className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {group.label}
              </h4>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring",
                        isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="mt-auto border-t p-4 space-y-4">
        <OrganizationSelector />
        <UserMenu />
      </div>
    </div>
  )
}
