import { Node } from '@xyflow/react'
import { WorkflowStepEditor } from './workflow-step-editor'
import { TriggerEditor } from './trigger-editor'
import { WorkflowStep, WorkflowTrigger } from '@/lib/graphql/workflows'

interface WorkflowInspectorProps {
  selectedNode: Node | null
  canEdit: boolean
  onSaveNode: (nodeId: string, data: any) => void
  onDeleteNode: (nodeId: string) => void
  onClose: () => void
}

export function WorkflowInspector({ selectedNode, canEdit, onSaveNode, onDeleteNode, onClose }: WorkflowInspectorProps) {
  if (!selectedNode) {
    return null;
  }

  if (selectedNode.type === 'triggerNode') {
    return (
      <TriggerEditor
        triggers={[selectedNode.data as unknown as WorkflowTrigger]}
        open={true}
        onOpenChange={(val) => { if (!val) onClose() }}
        canEdit={canEdit}
        onSave={(triggers) => {
          if (triggers.length > 0) {
            onSaveNode(selectedNode.id, triggers[0])
          } else {
            onDeleteNode(selectedNode.id)
          }
        }}
      />
    )
  }

  if (selectedNode.type === 'actionNode' || selectedNode.type === 'conditionalNode') {
    return (
      <WorkflowStepEditor
        step={selectedNode.data as unknown as WorkflowStep}
        allSteps={[]} // Removed since we use visual edges for conditional branches now
        open={true}
        onOpenChange={(val) => { if (!val) onClose() }}
        onSave={(step) => {
          onSaveNode(selectedNode.id, step)
        }}
        onDelete={() => onDeleteNode(selectedNode.id)}
      />
    )
  }

  return (
    <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4 text-center">
      Unknown node type.
    </div>
  )
}
