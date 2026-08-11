import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ZapifyMark } from "@/components/brand/zapify-mark"

export const metadata = {
  title: "Overview | Zapify",
}

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground mt-2">
          Build, run, and monitor your AI workflows.
        </p>
      </div>

      <div className="mt-8">
        <EmptyState
          icon={ZapifyMark}
          title="No workflows yet"
          description="Build an automated AI workflow by connecting models, APIs, conditions, and approval steps."
          action={
            <Button>
              Create workflow
            </Button>
          }
        />
      </div>
    </div>
  )
}
