import Link from "next/link"
import { ArrowLeft, Clock, Save, Loader2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WorkflowToolbarProps {
  name: string
  isDraft: boolean
  updatedAt: string
  stepCount: number
  triggerTypes: string[]
  saveState: "saved" | "unsaved" | "saving" | "error"
  onSave: () => void
  onRun: () => void
  canEdit: boolean
}

export function WorkflowToolbar({
  name,
  isDraft,
  updatedAt,
  stepCount,
  triggerTypes,
  saveState,
  onSave,
  onRun,
  canEdit,
}: WorkflowToolbarProps) {
  const date = new Date(updatedAt)
  const formattedDate = date.toLocaleString(undefined, { 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })

  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b pb-6">
      <div>
        <Button variant="ghost" asChild className="gap-2 -ml-4 mb-2 text-muted-foreground hover:text-foreground transition-colors">
          <Link href="/app/workflows">
            <ArrowLeft className="h-4 w-4" />
            Back to workflows
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
          {isDraft && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium uppercase tracking-wider">
              Draft
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-3">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-foreground">{stepCount}</span> {stepCount === 1 ? 'step' : 'steps'}
          </div>
          <span>&middot;</span>
          <div className="flex items-center gap-1.5 capitalize">
            {triggerTypes.length > 0 ? triggerTypes.join(", ") + " trigger" : "No trigger"}
          </div>
          <span>&middot;</span>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Updated {formattedDate}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-3 shrink-0 mt-4 sm:mt-0">
        <div className="flex items-center text-sm font-medium">
          {saveState === "unsaved" && <span className="text-muted-foreground mr-4">Unsaved changes</span>}
          {saveState === "saving" && <span className="text-muted-foreground mr-4 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin"/> Saving...</span>}
          {saveState === "saved" && <span className="text-muted-foreground mr-4">Saved</span>}
          {saveState === "error" && <span className="text-destructive mr-4">Save failed</span>}
        </div>
        <Button variant="outline" onClick={onRun} disabled title="Execution UI coming in M4.4b">
          <Play className="h-4 w-4 mr-2" />
          Run
        </Button>
        {canEdit && (
          <Button onClick={onSave} disabled={saveState === "saving" || saveState === "saved"}>
            <Save className="h-4 w-4 mr-2" />
            Save changes
          </Button>
        )}
      </div>
    </div>
  )
}
