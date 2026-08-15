import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Globe, Bot, UserCheck, Database, Bell, Settings } from 'lucide-react'

const icons: Record<string, React.ElementType> = {
  http_request: Globe,
  llm_call: Bot,
  approval_gate: UserCheck,
  db_write: Database,
  notify: Bell,
}

import { getStatusStyles } from './utils'

export const ActionNode = memo(({ data, selected }: { data: { type?: string, status?: string, label?: string, description?: string }; selected?: boolean }) => {
  const Icon = (data.type && icons[data.type]) || Settings
  const { border, iconClass, BadgeIcon } = getStatusStyles(data.status, selected)

  return (
    <div className={`px-4 py-3 shadow-sm rounded-xl border ${border} min-w-[200px] relative`}>
      {BadgeIcon && (
        <div className={`absolute -top-2 -right-2 bg-background rounded-full p-0.5 border shadow-sm ${iconClass}`}>
          <BadgeIcon className="w-4 h-4" />
        </div>
      )}
      <Handle 
        type="target" 
        position={Position.Top} 
        className="w-3 h-3 border-2 bg-background border-muted-foreground" 
      />
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center h-8 w-8 rounded-lg border bg-background ${data.status ? iconClass : 'text-foreground'}`}>
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
