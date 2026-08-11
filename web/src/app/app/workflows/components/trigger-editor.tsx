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
import { Input } from "@/components/ui/input"
import { Zap, Hand, Webhook, Clock, Database } from "lucide-react"

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
      config: val === "database_event" ? { table: "workflow_custom_data", operation: "INSERT" } : (val === "scheduled" ? { cron: "*/5 * * * *" } : {}),
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
                    <SelectItem value="scheduled">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2" />
                        Scheduled
                      </div>
                    </SelectItem>
                    <SelectItem value="database_event">
                      <div className="flex items-center">
                        <Database className="h-4 w-4 mr-2" />
                        Database Event
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
                
                {draftTrigger.trigger_type === "scheduled" && (
                  <div className="pt-4 space-y-2">
                    <Label>Cron Expression</Label>
                    <Input 
                      value={(draftTrigger.config.cron as string) || ""}
                      onChange={(e) => setDraftTrigger({
                        ...draftTrigger,
                        config: { ...draftTrigger.config, cron: e.target.value }
                      })}
                      placeholder="*/5 * * * *"
                      disabled={!canEdit}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Supports standard cron format (e.g. <code>*/5 * * * *</code> for every 5 minutes).
                    </p>
                  </div>
                )}

                {draftTrigger.trigger_type === "database_event" && (
                  <div className="pt-4 space-y-4">
                    <div className="space-y-2">
                      <Label>Watched Table</Label>
                      <Select 
                        value={(draftTrigger.config.table as string) || ""}
                        onValueChange={(val) => setDraftTrigger({
                          ...draftTrigger,
                          config: { ...draftTrigger.config, table: val }
                        })}
                        disabled={!canEdit}
                      >
                        <SelectTrigger><SelectValue placeholder="Select a table" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="workflow_custom_data">workflow_custom_data</SelectItem>
                          <SelectItem value="workflows">workflows</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Operation</Label>
                      <Select 
                        value={(draftTrigger.config.operation as string) || ""}
                        onValueChange={(val) => setDraftTrigger({
                          ...draftTrigger,
                          config: { ...draftTrigger.config, operation: val }
                        })}
                        disabled={!canEdit}
                      >
                        <SelectTrigger><SelectValue placeholder="Select an operation" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INSERT">INSERT</SelectItem>
                          <SelectItem value="UPDATE">UPDATE</SelectItem>
                          <SelectItem value="DELETE">DELETE</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
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
