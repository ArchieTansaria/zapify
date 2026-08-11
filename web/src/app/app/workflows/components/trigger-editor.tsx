import { useState, useEffect } from "react"
import { WorkflowTrigger } from "@/lib/graphql/workflows"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Zap, Hand, Webhook } from "lucide-react"

interface TriggerEditorProps {
  triggers: WorkflowTrigger[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (triggers: WorkflowTrigger[]) => void
  canEdit: boolean
}

export function TriggerEditor({
  triggers,
  open,
  onOpenChange,
  onSave,
  canEdit
}: TriggerEditorProps) {
  // For M4.4a, we only support one trigger for simplicity in the UI,
  // but we pass around the array to respect the schema.
  const [draftTrigger, setDraftTrigger] = useState<WorkflowTrigger | null>(null)
  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        if (triggers.length > 0) {
          setDraftTrigger(JSON.parse(JSON.stringify(triggers[0])))
        } else {
          setDraftTrigger(null)
        }
      })
    }
  }, [triggers, open])

  const handleSave = () => {
    if (draftTrigger) {
      onSave([draftTrigger])
    } else {
      onSave([])
    }
    onOpenChange(false)
  }

  const handleDelete = () => {
    setDraftTrigger(null)
  }

  const handleTypeChange = (val: string) => {
    setDraftTrigger({
      id: draftTrigger?.id || "draft",
      trigger_type: val,
      config: {},
      is_active: true
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Workflow Triggers</DialogTitle>
          <DialogDescription>
            Configure how this workflow is executed.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-6">
          {!draftTrigger ? (
            <div className="text-center py-6 space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Zap className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-4">No trigger is configured.</p>
                {canEdit && (
                  <Button onClick={() => handleTypeChange("manual")}>
                    Add Trigger
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Trigger Type</Label>
                <Select 
                  value={draftTrigger.trigger_type} 
                  onValueChange={handleTypeChange}
                  disabled={!canEdit || draftTrigger.trigger_type === "webhook"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">
                      <div className="flex items-center">
                        <Hand className="h-4 w-4 mr-2" />
                        Manual
                      </div>
                    </SelectItem>
                    <SelectItem value="webhook" disabled>
                      <div className="flex items-center">
                        <Webhook className="h-4 w-4 mr-2" />
                        Webhook (Admin only)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {draftTrigger.trigger_type === "webhook" && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Webhook triggers require secure server-side secret generation and cannot be modified from the builder yet.
                  </p>
                )}
              </div>

              {canEdit && draftTrigger.trigger_type !== "webhook" && (
                <div className="pt-4 border-t flex justify-end">
                  <Button variant="destructive" size="sm" onClick={handleDelete}>
                    Remove Trigger
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {canEdit && <Button onClick={handleSave}>Save</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
