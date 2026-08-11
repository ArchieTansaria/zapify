import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type RunStatus = 'running' | 'completed' | 'failed' | 'paused' | 'waiting_for_approval' | 'pending'

interface StatusBadgeProps {
  status: RunStatus | string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  let colorClass = "bg-muted text-muted-foreground hover:bg-muted" // pending/default

  switch (status) {
    case 'running':
      colorClass = "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20"
      break
    case 'completed':
      colorClass = "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20"
      break
    case 'failed':
      colorClass = "bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20"
      break
    case 'paused':
    case 'waiting_for_approval':
      colorClass = "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20"
      break
  }

  const label = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

  return (
    <Badge variant="outline" className={cn("font-medium", colorClass, className)}>
      {label}
    </Badge>
  )
}
