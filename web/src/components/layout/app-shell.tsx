"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "./sidebar"
import { MobileNav } from "./mobile-nav"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const saved = localStorage.getItem("zapify:sidebar-collapsed")
    if (saved === "true") {
      // Small timeout to allow hydration to complete before updating state
      setTimeout(() => setIsCollapsed(true), 0)
    }
  }, [])

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const next = !prev
      localStorage.setItem("zapify:sidebar-collapsed", String(next))
      return next
    })
  }

  const isWorkflowEditor = pathname.match(/^\/app\/workflows\/[a-zA-Z0-9-]+$/)

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-background">
      <div className={`hidden md:block shrink-0 transition-all duration-300 ${isCollapsed ? "w-16" : "w-64"}`}>
        <Sidebar isCollapsed={isCollapsed} onToggle={toggleSidebar} />
      </div>
      <MobileNav />
      {isWorkflowEditor ? (
        <main className="flex-1 flex flex-col min-h-0 min-w-0 h-screen">
          {children}
        </main>
      ) : (
        <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
          {children}
        </main>
      )}
    </div>
  )
}
