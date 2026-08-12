import { WorkflowStep, WorkflowTrigger } from "@/lib/graphql/workflows"
import { Node, Edge } from "@xyflow/react"

export function buildGraphFromBackend(
  steps: WorkflowStep[],
  triggers: WorkflowTrigger[]
): { nodes: Node[], edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  let currentY = 50

  // 1. Map Triggers
  triggers.forEach((trigger) => {
    const position = (trigger.config as any)?._ui?.position || { x: 250, y: currentY }
    currentY += 100

    nodes.push({
      id: trigger.id,
      type: 'triggerNode',
      position,
      data: {
        ...trigger,
        label: trigger.trigger_type.replace('_', ' '),
        description: 'Workflow trigger'
      }
    })
  })

  // 2. Map Steps
  // Sort by step_order just to establish the baseline sequence
  const sortedSteps = [...steps].sort((a, b) => a.step_order - b.step_order)

  sortedSteps.forEach((step) => {
    const position = (step.config as any)?._ui?.position || { x: 250, y: currentY }
    currentY += 100

    nodes.push({
      id: step.id,
      type: step.step_type === 'conditional_branch' ? 'conditionalNode' : 'actionNode',
      position,
      data: {
        ...step,
        label: step.name,
        description: step.step_type.replace('_', ' ')
      }
    })
  })

  // 3. Reconstruct Edges based on step_order and jumps
  // For Trigger -> First Step
  if (triggers.length > 0 && sortedSteps.length > 0) {
    edges.push({
      id: `e-${triggers[0].id}-${sortedSteps[0].id}`,
      source: triggers[0].id,
      target: sortedSteps[0].id
    })
  }

  // Collect branch targets to prevent false sequential edges
  const branchTargetIds = new Set<string>();
  
  sortedSteps.forEach((step) => {
    if (step.step_type === 'conditional_branch') {
      const config = step.config as any;
      if (config?.if_true) branchTargetIds.add(config.if_true);
      if (config?.if_false) branchTargetIds.add(config.if_false);
    }
  });

  // Normal Edges (fall-throughs)
  for (let i = 0; i < sortedSteps.length - 1; i++) {
    const current = sortedSteps[i]
    const next = sortedSteps[i + 1]

    if (current.step_type === 'conditional_branch') continue;
    if (branchTargetIds.has(current.id)) continue;

    edges.push({
      id: `e-${current.id}-${next.id}`,
      source: current.id,
      target: next.id
    })
  }

  // Conditional Edges
  sortedSteps.forEach((step) => {
    if (step.step_type === 'conditional_branch') {
      const config = step.config as any
      if (config?.if_true) {
        edges.push({
          id: `e-${step.id}-true-${config.if_true}`,
          source: step.id,
          sourceHandle: 'true',
          target: config.if_true,
          style: { stroke: '#22c55e' }
        })
        
        // Reconstruct visual explicit 'after' join edge
        if (config.after && config.if_true !== config.after) {
          edges.push({
            id: `e-${config.if_true}-${config.after}`,
            source: config.if_true,
            target: config.after
          })
        }
      }
      
      if (config?.if_false) {
        edges.push({
          id: `e-${step.id}-false-${config.if_false}`,
          source: step.id,
          sourceHandle: 'false',
          target: config.if_false,
          style: { stroke: '#ef4444' }
        })
        
        // Reconstruct visual explicit 'after' join edge
        if (config.after && config.if_false !== config.after) {
          edges.push({
            id: `e-${config.if_false}-${config.after}`,
            source: config.if_false,
            target: config.after
          })
        }
      }
    }
  })

  return { nodes, edges }
}
