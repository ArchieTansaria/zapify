import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Globe, Bot, UserCheck, Database, Bell, Settings } from 'lucide-react'

const icons: Record<string, any> = {
  http_request: Globe,
  llm_call: Bot,
  approval_gate: UserCheck,
  db_write: Database,
  notify: Bell,
}

export const ActionNode = memo(({ data, selected }: any) => {
  const Icon = icons[data.type] || Settings

  return (
    <div className={`px-4 py-3 shadow-sm rounded-xl bg-card border ${selected ? 'border-primary ring-1 ring-primary/20 shadow-md' : 'border-border'} min-w-[200px]`}>
      <Handle 
        type="target" 
        position={Position.Top} 
        className="w-3 h-3 border-2 bg-background border-muted-foreground" 
      />
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted text-foreground border">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">{data.label || 'Action'}</div>
          <div className="text-xs text-muted-foreground truncate max-w-[140px]">{data.description || 'Action step'}</div>
        </div>
      </div>
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="w-3 h-3 border-2 bg-background border-muted-foreground" 
      />
    </div>
  )
})
ActionNode.displayName = 'ActionNode'
