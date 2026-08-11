"use client"

import * as React from "react"
import { Building2, ChevronsUpDown, Check } from "lucide-react"
import { useOrganization } from "@/components/providers/organization-provider"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function OrganizationSelector() {
  const { organizations, currentOrganization, switchOrganization, isLoading } = useOrganization()
  
  if (isLoading) {
    return (
      <div className="flex h-12 w-full items-center px-2">
        <div className="h-8 w-8 rounded bg-muted animate-pulse" />
        <div className="ml-2 h-4 w-20 rounded bg-muted animate-pulse" />
      </div>
    )
  }

  const currentOrg = currentOrganization || organizations[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md p-2 hover:bg-muted w-full focus:outline-none focus:ring-1 focus:ring-ring border border-transparent hover:border-border transition-colors">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-foreground border">
          <Building2 className="h-3 w-3" />
        </div>
        <span className="text-sm font-medium leading-none flex-1 text-left truncate">
          {currentOrg ? currentOrg.name : "No Organization"}
        </span>
        <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground uppercase">
          Organizations
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((org) => (
          <DropdownMenuItem 
            key={org.id} 
            className="flex items-center gap-2"
            onClick={() => switchOrganization(org.id)}
          >
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-muted text-foreground border">
              <Building2 className="h-3 w-3" />
            </div>
            <span className="flex-1 truncate">{org.name}</span>
            {currentOrg && org.id === currentOrg.id && (
              <Check className="h-4 w-4 shrink-0 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          Create organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
