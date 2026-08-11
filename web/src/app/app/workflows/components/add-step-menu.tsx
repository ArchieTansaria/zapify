import { Plus, Bot, Globe, GitBranch, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { WorkflowStep } from "@/lib/graphql/workflows"
// uuid import removed

interface AddStepMenuProps {
  onAddStep: (step: WorkflowStep) => void
  disabled?: boolean
}

export function AddStepMenu({ onAddStep, disabled }: AddStepMenuProps) {
  const handleAdd = (type: string, name: string, initialConfig: Record<string, unknown> = {}) => {
    onAddStep({
      id: crypto.randomUUID(), // Temporary ID for draft
      step_type: type,
      name,
      config: initialConfig,
      step_order: 0 // Will be assigned by parent
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 border-dashed" disabled={disabled}>
          <Plus className="h-4 w-4" />
          Add step
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onClick={() => handleAdd("llm_call", "LLM Call", { prompt: "", model: "llama3-8b-8192" })}>
          <Bot className="h-4 w-4 mr-2 text-primary" />
          LLM Call
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleAdd("http_request", "HTTP Request", { method: "GET", url: "", headers: {} })}>
          <Globe className="h-4 w-4 mr-2 text-primary" />
          HTTP Request
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleAdd("conditional_branch", "Conditional Branch", { source: "previous_output", operator: "equals", value: "", if_true: null, if_false: null })}>
          <GitBranch className="h-4 w-4 mr-2 text-primary" />
          Conditional Branch
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleAdd("approval_gate", "Approval Gate", {})}>
          <CheckCircle className="h-4 w-4 mr-2 text-primary" />
          Approval Gate
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
