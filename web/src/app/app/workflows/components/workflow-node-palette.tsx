import { Hand, Clock, Database, Globe, Bot, UserCheck, Bell, PenTool } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WorkflowNodePaletteProps {
  onAddTrigger: (type: string) => void
  onAddStep: (type: string) => void
  canEdit: boolean
  hasTrigger: boolean
}

export function WorkflowNodePalette({ onAddTrigger, onAddStep, canEdit, hasTrigger }: WorkflowNodePaletteProps) {
  const onDragStart = (event: React.DragEvent, nodeType: string, isTrigger: boolean) => {
    if (!canEdit) return;
    if (isTrigger && hasTrigger) return;
    
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.setData('application/reactflow/isTrigger', String(isTrigger))
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 font-semibold text-sm uppercase tracking-wider text-muted-foreground border-b">
        Nodes
      </div>
      
      <div className="p-4 space-y-6">
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-muted-foreground/70 uppercase tracking-widest mb-3">Triggers</h3>
          <div className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full justify-start h-9 text-xs cursor-grab active:cursor-grabbing" 
              disabled={!canEdit || hasTrigger}
              onClick={() => onAddTrigger('manual')}
              draggable={canEdit && !hasTrigger}
              onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, 'manual', true)}
            >
              <Hand className="h-3 w-3 mr-2 shrink-0" /> Manual
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start h-9 text-xs cursor-grab active:cursor-grabbing" 
              disabled={!canEdit || hasTrigger}
              onClick={() => onAddTrigger('scheduled')}
              draggable={canEdit && !hasTrigger}
              onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, 'scheduled', true)}
            >
              <Clock className="h-3 w-3 mr-2 shrink-0" /> Scheduled
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start h-9 text-xs cursor-grab active:cursor-grabbing" 
              disabled={!canEdit || hasTrigger}
              onClick={() => onAddTrigger('database_event')}
              draggable={canEdit && !hasTrigger}
              onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, 'database_event', true)}
            >
              <Database className="h-3 w-3 mr-2 shrink-0" /> Database Event
            </Button>
          </div>
          {hasTrigger && (
            <p className="text-[10px] text-muted-foreground mt-2 px-1">Only one trigger is supported per workflow.</p>
          )}
        </div>

        <div className="space-y-2 pt-2 border-t">
          <h3 className="text-xs font-bold text-muted-foreground/70 uppercase tracking-widest mb-3">Actions</h3>
          <div className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full justify-start h-9 text-xs cursor-grab active:cursor-grabbing" 
              disabled={!canEdit}
              onClick={() => onAddStep('http_request')}
              draggable={canEdit}
              onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, 'http_request', false)}
            >
              <Globe className="h-3 w-3 mr-2 shrink-0" /> HTTP Request
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start h-9 text-xs cursor-grab active:cursor-grabbing" 
              disabled={!canEdit}
              onClick={() => onAddStep('llm_call')}
              draggable={canEdit}
              onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, 'llm_call', false)}
            >
              <Bot className="h-3 w-3 mr-2 shrink-0" /> LLM Call
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start h-9 text-xs cursor-grab active:cursor-grabbing" 
              disabled={!canEdit}
              onClick={() => onAddStep('db_write')}
              draggable={canEdit}
              onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, 'db_write', false)}
            >
              <PenTool className="h-3 w-3 mr-2 shrink-0" /> DB Write
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start h-9 text-xs cursor-grab active:cursor-grabbing" 
              disabled={!canEdit}
              onClick={() => onAddStep('notify')}
              draggable={canEdit}
              onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, 'notify', false)}
            >
              <Bell className="h-3 w-3 mr-2 shrink-0" /> Notification
            </Button>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t">
          <h3 className="text-xs font-bold text-muted-foreground/70 uppercase tracking-widest mb-3">Logic</h3>
          <div className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full justify-start h-9 text-xs cursor-grab active:cursor-grabbing" 
              disabled={!canEdit}
              onClick={() => onAddStep('conditional_branch')}
              draggable={canEdit}
              onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, 'conditional_branch', false)}
            >
              <UserCheck className="h-3 w-3 mr-2 shrink-0" /> Condition
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start h-9 text-xs cursor-grab active:cursor-grabbing" 
              disabled={!canEdit}
              onClick={() => onAddStep('approval_gate')}
              draggable={canEdit}
              onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, 'approval_gate', false)}
            >
              <UserCheck className="h-3 w-3 mr-2 shrink-0" /> Approval Gate
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
