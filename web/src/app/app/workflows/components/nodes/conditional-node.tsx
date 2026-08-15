import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Split } from 'lucide-react'

import { getStatusStyles } from './utils'

export const ConditionalNode = memo(({ data, selected }: { data: { status?: string, label?: string, description?: string }; selected?: boolean }) => {
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
      
      <div className="flex items-center gap-3 mb-2">
        <div className={`flex items-center justify-center h-8 w-8 rounded-lg bg-orange-500/10 border ${data.status ? iconClass : 'text-orange-500 border-orange-500/20'}`}>
          <Split className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">{data.label || 'Condition'}</div>
          <div className="text-xs text-muted-foreground truncate max-w-[140px]">{data.description || 'if/else branch'}</div>
        </div>
      </div>

      <div className="flex justify-between mt-4 px-2 text-[10px] font-bold text-muted-foreground">
        <div className="flex flex-col items-center">
          <span className="text-green-600 dark:text-green-500">TRUE</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-destructive">FALSE</span>
        </div>
      </div>

      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="true"
        style={{ left: '25%' }}
        className="w-3 h-3 border-2 bg-background border-green-500" 
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="false"
        style={{ left: '75%' }}
        className="w-3 h-3 border-2 bg-background border-destructive" 
      />
    </div>
  )
})
ConditionalNode.displayName = 'ConditionalNode'
