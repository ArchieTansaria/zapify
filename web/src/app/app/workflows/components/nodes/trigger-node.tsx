import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Zap } from 'lucide-react'

import { getStatusStyles } from './utils'

export const TriggerNode = memo(({ data, selected }: { data: { status?: string, label?: string, description?: string }; selected?: boolean }) => {
  const { border, iconClass, BadgeIcon } = getStatusStyles(data.status, selected)

  return (
    <div className={`px-4 py-3 shadow-md rounded-xl border ${border} min-w-[200px] relative`}>
      {BadgeIcon && (
        <div className={`absolute -top-2 -right-2 bg-background rounded-full p-0.5 border ${iconClass}`}>
          <BadgeIcon className="w-4 h-4" />
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 ${data.status ? iconClass : 'text-primary'}`}>
          <Zap className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold capitalize">{data.label || 'Trigger'}</div>
          <div className="text-xs text-muted-foreground truncate max-w-[140px]">{data.description || 'Starts the workflow'}</div>
        </div>
      </div>
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="w-3 h-3 border-2 bg-background border-primary" 
      />
    </div>
  )
})
TriggerNode.displayName = 'TriggerNode'
