import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Plus } from "lucide-react"
import { ZapifyMark } from "@/components/brand/zapify-mark"

export const metadata = {
  title: "Workflows | Zapify",
}

export default function WorkflowsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground mt-2">
            Design and manage your automated AI sequences.
          </p>
        </div>
        <Button className="w-full sm:w-auto gap-2">
          <Plus className="h-4 w-4" />
          Create workflow
        </Button>
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
