import { useState } from "react"
import { Workflow, WorkflowStep, WorkflowTrigger, createWorkflowStep, updateWorkflowStep, deleteWorkflowStep, createWorkflowTrigger, updateWorkflowTrigger, deleteWorkflowTrigger } from "@/lib/graphql/workflows"
import { useOrganization } from "@/components/providers/organization-provider"
import { WorkflowToolbar } from "./workflow-toolbar"
import { WorkflowStepCard } from "./workflow-step-card"
import { WorkflowStepEditor } from "./workflow-step-editor"
import { AddStepMenu } from "./add-step-menu"
import { TriggerEditor } from "./trigger-editor"
import { Zap } from "lucide-react"

interface WorkflowEditorProps {
  initialWorkflow: Workflow
  onSaved: () => void
}

export function WorkflowEditor({ initialWorkflow, onSaved }: WorkflowEditorProps) {
  const { currentUserRole } = useOrganization()
  const canEdit = currentUserRole === "owner" || currentUserRole === "editor"
  
  const [steps, setSteps] = useState<WorkflowStep[]>(initialWorkflow.workflow_steps || [])
  const [triggers, setTriggers] = useState<WorkflowTrigger[]>(initialWorkflow.workflow_triggers || [])
  const [saveState, setSaveState] = useState<"saved" | "unsaved" | "saving" | "error">("saved")
  
  const [activeStep, setActiveStep] = useState<WorkflowStep | null>(null)
  const [isStepEditorOpen, setIsStepEditorOpen] = useState(false)
  const [isTriggerEditorOpen, setIsTriggerEditorOpen] = useState(false)

  // Mark as unsaved if steps or triggers change. 
  // We avoid strict deep equality for performance, trusting our setters to only run on actual mutations.

  const handleSaveStep = (updatedStep: WorkflowStep) => {
    setSteps(prev => {
      const idx = prev.findIndex(s => s.id === updatedStep.id)
      if (idx >= 0) {
        const newSteps = [...prev]
        newSteps[idx] = updatedStep
        return newSteps
      } else {
        return [...prev, updatedStep]
      }
    })
    setSaveState("unsaved")
  }

  const handleDeleteStep = (id: string) => {
    setSteps(prev => {
      const remaining = prev.filter(s => s.id !== id)
      // re-calculate step_order sequentially
      return remaining.map((s, idx) => ({ ...s, step_order: idx }))
    })
    setSaveState("unsaved")
  }

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === steps.length - 1)) return

    setSteps(prev => {
      const newSteps = [...prev]
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      
      // Swap
      const temp = newSteps[index]
      newSteps[index] = newSteps[targetIndex]
      newSteps[targetIndex] = temp
      
      // Re-assign step_order
      return newSteps.map((s, idx) => ({ ...s, step_order: idx }))
    })
    setSaveState("unsaved")
  }

  const handleSaveTriggers = (newTriggers: WorkflowTrigger[]) => {
    setTriggers(newTriggers)
    setSaveState("unsaved")
  }

  const persistChanges = async () => {
    setSaveState("saving")
    try {
      // Very naive diffing: just update/create everything. 
      // For deletions, we look at initial vs current.
      
      // 1. Process Triggers
      const initialTriggerIds = (initialWorkflow.workflow_triggers || []).map(t => t.id)
      const currentTriggerIds = triggers.filter(t => t.id !== 'draft').map(t => t.id)
      const triggersToDelete = initialTriggerIds.filter(id => !currentTriggerIds.includes(id))
      
      for (const id of triggersToDelete) {
        await deleteWorkflowTrigger(id)
      }
      for (const t of triggers) {
        if (t.id === 'draft') {
          await createWorkflowTrigger(initialWorkflow.id, t.trigger_type, t.config)
        } else {
          // Cannot modify webhook via builder, so just skip it
          if (t.trigger_type !== 'webhook') {
            await updateWorkflowTrigger(t.id, t.config, t.is_active)
          }
        }
      }

      // 2. Process Steps
      const initialStepIds = (initialWorkflow.workflow_steps || []).map(s => s.id)
      const currentRealIds = steps.map(s => s.id)
      const stepsToDelete = initialStepIds.filter(id => !currentRealIds.includes(id))

      for (const id of stepsToDelete) {
        await deleteWorkflowStep(id)
      }

      for (let i = 0; i < steps.length; i++) {
        const s = steps[i]
        // If it was in initial, update it. Else create.
        if (initialStepIds.includes(s.id)) {
          await updateWorkflowStep(s.id, s.name, s.config, i)
        } else {
          await createWorkflowStep(initialWorkflow.id, s.step_type, s.name, i, s.config)
        }
      }

      setSaveState("saved")
      onSaved() // trigger parent refresh
    } catch (err: unknown) {
      console.error(err)
      setSaveState("error")
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <WorkflowToolbar 
        name={initialWorkflow.name}
        isDraft={!initialWorkflow.is_active}
        updatedAt={initialWorkflow.updated_at}
        stepCount={steps.length}
        triggerTypes={triggers.map(t => t.trigger_type)}
        saveState={saveState}
        onSave={persistChanges}
        onRun={() => {}}
        canEdit={canEdit}
      />

      <div className="space-y-6">
        {/* Trigger Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wider uppercase text-muted-foreground">Trigger</h2>
          </div>
          
          <div 
            className={`border border-dashed rounded-lg p-6 flex flex-col items-center justify-center bg-card/50 transition-colors ${canEdit ? 'hover:bg-muted/30 cursor-pointer' : ''}`}
            onClick={() => setIsTriggerEditorOpen(true)}
          >
            {triggers.length === 0 ? (
              <p className="text-muted-foreground text-sm font-medium">No trigger configured</p>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary">
                  <Zap className="h-4 w-4" />
                </div>
                <p className="font-medium capitalize">{triggers[0].trigger_type} Trigger</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center">
          <div className="w-px h-6 bg-border"></div>
        </div>

        {/* Steps Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold tracking-wider uppercase text-muted-foreground">Steps</h2>
          </div>

          <div className="relative pl-4 space-y-4 before:absolute before:inset-y-0 before:left-[2.1rem] before:w-px before:bg-border before:-z-10">
            {steps.map((step, idx) => (
              <WorkflowStepCard 
                key={step.id}
                step={step}
                index={idx}
                totalSteps={steps.length}
                canEdit={canEdit}
                onEdit={() => {
                  setActiveStep(step)
                  setIsStepEditorOpen(true)
                }}
                onMoveUp={() => handleMoveStep(idx, 'up')}
                onMoveDown={() => handleMoveStep(idx, 'down')}
                onDelete={() => handleDeleteStep(step.id)}
              />
            ))}
            
            <div className="relative flex items-center gap-4 pt-2">
              <div className="flex items-center justify-center h-7 w-7 rounded-full bg-background border-2 border-dashed border-muted-foreground z-10 shrink-0">
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
              </div>
              <AddStepMenu 
                disabled={!canEdit}
                userRole={currentUserRole || undefined}
                onAddStep={(step) => {
                  setActiveStep({ ...step, step_order: steps.length })
                  setIsStepEditorOpen(true)
                }} 
              />
            </div>
          </div>
        </div>
      </div>

      <WorkflowStepEditor 
        step={activeStep}
        allSteps={steps}
        open={isStepEditorOpen}
        onOpenChange={setIsStepEditorOpen}
        onSave={handleSaveStep}
      />

      <TriggerEditor 
        triggers={triggers}
        open={isTriggerEditorOpen}
        onOpenChange={setIsTriggerEditorOpen}
        onSave={handleSaveTriggers}
        canEdit={canEdit}
      />
    </div>
  )
}
