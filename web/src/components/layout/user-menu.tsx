import { ChevronsUpDown, User } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function UserMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md p-2 hover:bg-muted w-full focus:outline-none focus:ring-1 focus:ring-ring border border-transparent hover:border-border transition-colors">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground border">
          <User className="h-4 w-4" />
        </div>
        <div className="flex flex-col items-start flex-1 overflow-hidden">
          <span className="text-sm font-medium leading-none truncate">Alice</span>
          <span className="text-xs text-muted-foreground mt-1 truncate">Owner</span>
        </div>
        <ChevronsUpDown className="h-4 w-4 text-muted-foreground ml-auto" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">Alice</p>
            <p className="text-xs leading-none text-muted-foreground">
              alice@test.com
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Billing</DropdownMenuItem>
        <DropdownMenuItem>API Keys</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:bg-destructive focus:text-destructive-foreground cursor-pointer">
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
