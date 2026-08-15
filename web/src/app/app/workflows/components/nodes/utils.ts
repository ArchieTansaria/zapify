import { CheckCircle2, Clock, PlayCircle, XCircle, AlertCircle, CircleDashed } from "lucide-react"

export function getStatusStyles(status?: string, selected?: boolean) {
  if (!status) {
    return {
      border: selected ? 'border-primary ring-1 ring-primary/20 shadow-md' : 'border-border bg-card',
      iconClass: 'text-muted-foreground',
      BadgeIcon: null
    }
  }

  switch (status) {
    case 'completed':
      return {
        border: 'border-green-500/50 bg-green-500/10 ring-1 ring-green-500/20 shadow-sm',
        iconClass: 'text-green-600 dark:text-green-400',
        BadgeIcon: CheckCircle2
      }
    case 'running':
      return {
        border: 'border-blue-500/50 bg-blue-500/10 ring-1 ring-blue-500/30 shadow-sm animate-pulse',
        iconClass: 'text-blue-600 dark:text-blue-400',
        BadgeIcon: PlayCircle
      }
    case 'failed':
      return {
        border: 'border-red-500/50 bg-red-500/10 ring-1 ring-red-500/20 shadow-sm',
        iconClass: 'text-red-600 dark:text-red-400',
        BadgeIcon: XCircle
      }
    case 'waiting_for_approval':
      return {
        border: 'border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/20 shadow-sm',
        iconClass: 'text-amber-600 dark:text-amber-400',
        BadgeIcon: AlertCircle
      }
    case 'skipped':
    case 'pending':
      return {
        border: 'border-dashed border-muted-foreground/30 bg-muted/20 opacity-70',
        iconClass: 'text-muted-foreground/50',
        BadgeIcon: status === 'skipped' ? CircleDashed : Clock
      }
    default:
      return {
        border: selected ? 'border-primary ring-1 ring-primary/20 shadow-md' : 'border-border bg-card',
        iconClass: 'text-muted-foreground',
        BadgeIcon: null
      }
  }
}
