"use client"

import { ChevronsUpDown, User } from "lucide-react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/providers/auth-provider"
import { nhost } from "@/lib/nhost"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function UserMenu() {
  const { user } = useAuth()
  const router = useRouter()

  if (!user) {
    return (
      <div className="flex h-12 w-full items-center px-2">
        <div className="h-8 w-8 rounded bg-muted animate-pulse" />
        <div className="ml-2 h-4 w-20 rounded bg-muted animate-pulse" />
      </div>
    )
  }

  const handleSignOut = async () => {
    try {
      const session = nhost.getUserSession()
      if (session?.refreshToken) {
        await nhost.auth.signOut({ refreshToken: session.refreshToken })
      }
      nhost.sessionStorage.remove() // Ensure local session is cleared
    } catch (err) {
      console.error("SignOut error:", err)
      nhost.sessionStorage.remove()
    }
    router.push("/signin")
    router.refresh()
  }

  const displayName = user.displayName || user.email?.split("@")[0] || "User"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md p-2 hover:bg-muted w-full focus:outline-none focus:ring-1 focus:ring-ring border border-transparent hover:border-border transition-colors">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground border">
          <User className="h-4 w-4" />
        </div>
        <div className="flex flex-col items-start flex-1 overflow-hidden">
          <span className="text-sm font-medium leading-none truncate">{displayName}</span>
          <span className="text-xs text-muted-foreground mt-1 truncate">User</span>
        </div>
        <ChevronsUpDown className="h-4 w-4 text-muted-foreground ml-auto" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Billing</DropdownMenuItem>
        <DropdownMenuItem>API Keys</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={handleSignOut}
          className="text-destructive focus:bg-destructive focus:text-destructive-foreground cursor-pointer"
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
