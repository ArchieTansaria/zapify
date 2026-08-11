import { Bot, Globe, GitBranch, CheckCircle, MoreVertical, Settings, ArrowUp, ArrowDown, Trash, Database, Bell } from "lucide-react"
import { WorkflowStep } from "@/lib/graphql/workflows"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

interface WorkflowStepCardProps {
  step: WorkflowStep
  index: number
  totalSteps: number
  onEdit: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  canEdit: boolean
}

const STEP_ICONS: Record<string, React.ReactNode> = {
  llm_call: <Bot className="h-5 w-5" />,
  http_request: <Globe className="h-5 w-5" />,
  conditional_branch: <GitBranch className="h-5 w-5" />,
  approval_gate: <CheckCircle className="h-5 w-5" />,
  db_write: <Database className="h-5 w-5" />,
  notify: <Bell className="h-5 w-5" />
}

const STEP_LABELS: Record<string, string> = {
  llm_call: "LLM Call",
  http_request: "HTTP Request",
  conditional_branch: "Conditional Branch",
  approval_gate: "Approval Gate",
  db_write: "Database Write",
  notify: "Notification"
}

export function WorkflowStepCard({
  step,
  index,
  totalSteps,
  onEdit,
  onMoveUp,
  onMoveDown,
  onDelete,
  canEdit
}: WorkflowStepCardProps) {
  
  // Concise config summary
  let configSummary = "No configuration"
  if (step.step_type === "llm_call") {
    const model = step.config.model || "Default Model"
    const hasPrompt = !!step.config.prompt
    configSummary = `${model} · ${hasPrompt ? "Prompt configured" : "No prompt"}`
  } else if (step.step_type === "http_request") {
    const method = step.config.method || "GET"
    const url = step.config.url || "No URL"
    configSummary = `${method} ${url}`
  } else if (step.step_type === "conditional_branch") {
    const src = step.config.source || "previous_output"
    const op = (step.config.operator as string) || "equals"
    const val = step.config.value || ""
    configSummary = `If ${src} ${op.replace('_', ' ')} "${val}"`
  } else if (step.step_type === "approval_gate") {
    configSummary = "Requires manual approval to proceed"
  } else if (step.step_type === "db_write") {
    configSummary = "Write to database"
  } else if (step.step_type === "notify") {
    const target = step.config.target_url ? "webhook" : "unconfigured"
    configSummary = `Send notification to ${target}`
  }

  return (
    <div className="relative flex items-start gap-4 group">
      <div className="flex flex-col items-center gap-1 z-10 shrink-0 mt-2">
        <div className="flex items-center justify-center h-7 w-7 rounded-full bg-background border-2 border-primary">
          <span className="text-xs font-bold">{index + 1}</span>
        </div>
      </div>
      
      <div 
        className={`flex-1 border rounded-xl p-5 bg-card/60 backdrop-blur-sm shadow-sm transition-all duration-200 ease-out group-hover:shadow-md ${canEdit ? 'hover:-translate-y-0.5 hover:border-primary/50 cursor-pointer hover:bg-card/90' : ''}`}
        onClick={() => canEdit && onEdit()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3.5">
            <div className="mt-0.5 text-foreground/80 p-2 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/10 shadow-inner">
              {STEP_ICONS[step.step_type] || <Bot className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="font-semibold text-base leading-none mb-1.5">{step.name}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/70 uppercase tracking-wider">{STEP_LABELS[step.step_type] || step.step_type}</span>
                <span>&middot;</span>
                <span className="truncate max-w-[200px] sm:max-w-[300px]">{configSummary}</span>
              </div>
            </div>
          </div>
          
          {canEdit && (
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-muted-foreground hover:text-foreground">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onEdit}>
                    <Settings className="h-4 w-4 mr-2" /> Edit step
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onMoveUp} disabled={index === 0}>
                    <ArrowUp className="h-4 w-4 mr-2" /> Move up
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onMoveDown} disabled={index === totalSteps - 1}>
                    <ArrowDown className="h-4 w-4 mr-2" /> Move down
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                    <Trash className="h-4 w-4 mr-2" /> Delete step
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
