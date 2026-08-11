import { useEffect, useState } from "react"
import { WorkflowStep } from "@/lib/graphql/workflows"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface WorkflowStepEditorProps {
  step: WorkflowStep | null
  allSteps: WorkflowStep[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (step: WorkflowStep) => void
}

export function WorkflowStepEditor({
  step,
  allSteps,
  open,
  onOpenChange,
  onSave
}: WorkflowStepEditorProps) {
  const [draft, setDraft] = useState<WorkflowStep | null>(null)

  useEffect(() => {
    if (step && open) {
      // Deep clone to avoid mutating parent state directly
      queueMicrotask(() => {
        setDraft(JSON.parse(JSON.stringify(step)))
      })
    }
  }, [step, open])

  if (!draft) return null

  const handleSave = () => {
    if (draft) {
      onSave(draft)
      onOpenChange(false)
    }
  }

  const updateConfig = (key: string, value: unknown) => {
    setDraft({
      ...draft,
      config: {
        ...draft.config,
        [key]: value
      }
    })
  }

  const renderConfigEditor = () => {
    switch (draft.step_type) {
      case "llm_call":
        return (
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select 
                value={(draft.config.model as string) || "llama3-8b-8192"} 
                onValueChange={(val) => updateConfig("model", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="llama3-8b-8192">llama3-8b-8192</SelectItem>
                  <SelectItem value="mixtral-8x7b-32768">mixtral-8x7b-32768</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="prompt">Prompt Template</Label>
              </div>
              <Textarea 
                id="prompt" 
                placeholder="Enter prompt..." 
                className="min-h-[150px] font-mono text-sm"
                value={(draft.config.prompt as string) || ""}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateConfig("prompt", e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use <code className="bg-muted px-1 py-0.5 rounded text-foreground">{"{{previous_output}}"}</code> to inject the result of the previous step.
              </p>
            </div>
          </div>
        )
        
      case "http_request":
        return (
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-[100px_1fr] gap-4">
              <div className="space-y-2">
                <Label htmlFor="method">Method</Label>
                <Select 
                  value={(draft.config.method as string) || "GET"} 
                  onValueChange={(val) => updateConfig("method", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="GET" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input 
                  id="url" 
                  type="url" 
                  placeholder="https://api.example.com/v1/data" 
                  value={(draft.config.url as string) || ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig("url", e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="headers">Headers (JSON)</Label>
              <Textarea 
                id="headers" 
                placeholder='{"Authorization": "Bearer token"}' 
                className="font-mono text-sm"
                value={typeof draft.config.headers === 'string' ? draft.config.headers : JSON.stringify(draft.config.headers || {}, null, 2)}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  try {
                    const parsed = JSON.parse(e.target.value)
                    updateConfig("headers", parsed)
                  } catch {
                    updateConfig("headers", e.target.value)
                  }
                }}
              />
            </div>
            
            {draft.config.method !== "GET" && draft.config.method !== "DELETE" && (
              <div className="space-y-2">
                <Label htmlFor="body">Body</Label>
                <Textarea 
                  id="body" 
                  placeholder="Enter request body..." 
                  className="min-h-[100px] font-mono text-sm"
                  value={typeof draft.config.body === 'string' ? draft.config.body : JSON.stringify(draft.config.body || {}, null, 2)}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                    try {
                      const parsed = JSON.parse(e.target.value)
                      updateConfig("body", parsed)
                    } catch {
                      updateConfig("body", e.target.value)
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use <code className="bg-muted px-1 py-0.5 rounded text-foreground">{"{{previous_output}}"}</code> to inject the previous result.
                </p>
              </div>
            )}
          </div>
        )
        
      case "conditional_branch":
        // Filter out the current step to prevent circular logic in UI
        const otherSteps = allSteps.filter(s => s.id !== draft.id)
        
        return (
          <div className="space-y-6 pt-4">
            <div className="p-4 border rounded-md bg-muted/20 space-y-4">
              <h4 className="text-sm font-medium">Condition</h4>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Select 
                    value={(draft.config.source as string) || "previous_output"} 
                    onValueChange={(val) => updateConfig("source", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="previous_output">Previous step output</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Operator</Label>
                  <Select 
                    value={(draft.config.operator as string) || "equals"} 
                    onValueChange={(val) => updateConfig("operator", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Operator" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equals">Equals (==)</SelectItem>
                      <SelectItem value="not_equals">Not Equals (!=)</SelectItem>
                      <SelectItem value="contains">Contains</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Comparison Value</Label>
                  <Input 
                    value={(draft.config.value as string) || ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig("value", e.target.value)}
                    placeholder="Value to compare against"
                  />
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 p-3 border border-green-500/20 bg-green-500/5 rounded-md">
                <Label className="text-green-600 dark:text-green-500">If True, jump to</Label>
                <Select 
                  value={(draft.config.if_true as string) || ""} 
                  onValueChange={(val) => updateConfig("if_true", val)}
                >
                  <SelectTrigger className="border-green-500/20 focus:ring-green-500/30">
                    <SelectValue placeholder="Select target step" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherSteps.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.step_order + 1}. {s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2 p-3 border border-destructive/20 bg-destructive/5 rounded-md">
                <Label className="text-destructive">If False, jump to</Label>
                <Select 
                  value={(draft.config.if_false as string) || ""} 
                  onValueChange={(val) => updateConfig("if_false", val)}
                >
                  <SelectTrigger className="border-destructive/20 focus:ring-destructive/30">
                    <SelectValue placeholder="Select target step" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherSteps.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.step_order + 1}. {s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
          </div>
        )
        
      case "approval_gate":
        return (
          <div className="space-y-4 pt-4">
            <div className="p-4 border rounded-md bg-muted/20 text-sm text-muted-foreground">
              <p>The workflow execution will pause at this step.</p>
              <p className="mt-2">An authorized user must manually approve or reject the run from the Execution UI (M4.4b) for it to continue to the next step.</p>
            </div>
            {/* Any future approval config can go here */}
          </div>
        )
        
      case "db_write":
        return (
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Payload (JSON)</Label>
              <Textarea 
                value={typeof draft.config.payload === 'string' ? draft.config.payload : JSON.stringify(draft.config.payload, null, 2)}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateConfig("payload", e.target.value)}
                placeholder={'{\n  "result": "{{previous_output}}"\n}'}
                rows={10}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter JSON payload to write. Use <code>{`{{previous_output}}`}</code> to inject the previous step&apos;s output.
              </p>
            </div>
          </div>
        )

      case "notify":
        return (
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Target Webhook URL</Label>
              <Input 
                value={(draft.config.target_url as string) || ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig("target_url", e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
              />
            </div>
            
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea 
                value={(draft.config.message as string) || ""}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateConfig("message", e.target.value)}
                placeholder="Workflow completed successfully."
                rows={5}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Supports <code>{`{{previous_output}}`}</code> template.
              </p>
            </div>
          </div>
        )
        
      default:
        return null
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Step</SheetTitle>
          <SheetDescription>
            Configure the parameters for this step.
          </SheetDescription>
        </SheetHeader>
        
        <div className="py-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Step Name</Label>
            <Input 
              id="name" 
              value={draft.name} 
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, name: e.target.value })} 
            />
          </div>
          
          <div className="border-t pt-4">
            <h3 className="font-semibold text-sm mb-2 uppercase tracking-wider text-muted-foreground">Configuration</h3>
            {renderConfigEditor()}
          </div>
        </div>
        
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save step</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
