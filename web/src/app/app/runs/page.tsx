import { Activity } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import { StatusBadge } from "@/components/ui/status-badge"

export const metadata = {
  title: "Runs | Zapify",
}

export default function RunsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Runs</h1>
        <p className="text-muted-foreground mt-2">
          View execution history and manage pending approvals.
        </p>
      </div>

      <div className="mt-8">
        <EmptyState
          icon={Activity}
          title="No runs found"
          description="Workflow executions will appear here once you trigger them."
        />
      </div>

      {/* Hidden example of how the status badges look in code so we can verify the colors */}
      <div className="hidden space-x-2">
        <StatusBadge status="running" />
        <StatusBadge status="completed" />
        <StatusBadge status="failed" />
        <StatusBadge status="paused" />
        <StatusBadge status="waiting_for_approval" />
        <StatusBadge status="pending" />
      </div>
    </div>
  )
}
