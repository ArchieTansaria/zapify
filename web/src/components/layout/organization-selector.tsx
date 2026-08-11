import { ChevronsUpDown, Check, Building2 } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const orgs = [
  { id: "1", name: "Acme Corp" },
  { id: "2", name: "Personal" },
]

export function OrganizationSelector() {
  const currentOrg = orgs[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md p-2 hover:bg-muted w-full focus:outline-none focus:ring-1 focus:ring-ring border border-transparent hover:border-border transition-colors">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-foreground border">
          <Building2 className="h-3 w-3" />
        </div>
        <span className="text-sm font-medium leading-none flex-1 text-left truncate">
          {currentOrg.name}
        </span>
        <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground uppercase">
          Organizations
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {orgs.map((org) => (
          <DropdownMenuItem key={org.id} className="flex items-center gap-2">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-muted text-foreground border">
              <Building2 className="h-3 w-3" />
            </div>
            <span className="flex-1 truncate">{org.name}</span>
            {org.id === currentOrg.id && (
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
