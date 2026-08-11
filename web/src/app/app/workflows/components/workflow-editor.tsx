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
    <div className="relative min-h-[calc(100vh-4rem)]">
      <div className="absolute inset-0 z-[-1] bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)] [background-size:20px_20px] opacity-50" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background to-transparent z-[-1]" />
      
      <div className="max-w-4xl mx-auto space-y-10 pb-16 pt-6 px-4">
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
        <div className="space-y-4 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-widest uppercase text-muted-foreground/70">Trigger</h2>
          </div>
          
          <div 
            className={`group relative overflow-hidden border rounded-xl p-6 flex flex-col items-center justify-center bg-card/60 backdrop-blur-sm shadow-sm transition-all duration-300 ease-out ${canEdit ? 'hover:shadow-md hover:border-primary/50 cursor-pointer hover:-translate-y-0.5' : ''}`}
            onClick={() => setIsTriggerEditorOpen(true)}
          >
            {/* Subtle glow effect on hover */}
            {canEdit && <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />}
            
            {triggers.length === 0 ? (
              <p className="text-muted-foreground text-sm font-medium relative z-10">No trigger configured</p>
            ) : (
              <div className="flex items-center gap-4 relative z-10">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 text-primary shadow-inner">
                  <Zap className="h-5 w-5" />
                </div>
                <p className="font-semibold text-lg capitalize tracking-tight">{triggers[0].trigger_type.replace('_', ' ')} Trigger</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center relative z-0">
          <div className="w-px h-10 bg-gradient-to-b from-border to-border/30"></div>
        </div>

        {/* Steps Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold tracking-widest uppercase text-muted-foreground/70">Steps</h2>
          </div>

          <div className="relative pl-5 sm:pl-8 space-y-5 before:absolute before:inset-y-0 before:left-[1.8rem] sm:before:left-[2.5rem] before:w-px before:bg-gradient-to-b before:from-border before:via-border/50 before:to-transparent before:-z-10">
            {steps.map((step, idx) => (
              <div 
                key={step.id} 
                className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
                style={{ animationDelay: `${(idx + 1) * 100}ms` }}
              >
                <WorkflowStepCard 
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
              </div>
            ))}
            
            <div 
              className="relative flex items-center gap-5 pt-4 animate-in fade-in duration-500 fill-mode-both"
              style={{ animationDelay: `${(steps.length + 1) * 100}ms` }}
            >
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-card border-2 border-dashed border-primary/30 z-10 shrink-0 shadow-sm">
                <div className="h-2 w-2 rounded-full bg-primary/40 animate-pulse" />
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
    </div>
  )
}
