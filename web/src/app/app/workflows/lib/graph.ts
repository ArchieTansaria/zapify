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

  const getIndex = (id?: string) => id ? sortedSteps.findIndex(s => s.id === id) : -1;
  const stepTargetMap = new Map<string, string | null>();

  // Initialize all to just the next node in the array
  for (let i = 0; i < sortedSteps.length - 1; i++) {
    stepTargetMap.set(sortedSteps[i].id, sortedSteps[i + 1].id);
  }
  stepTargetMap.set(sortedSteps[sortedSteps.length - 1]?.id, null);

  // Apply conditional branch tail logic
  sortedSteps.forEach((step) => {
    if (step.step_type === 'conditional_branch') {
      const config = step.config as any;
      const trueIdx = getIndex(config?.if_true);
      const falseIdx = getIndex(config?.if_false);
      const afterIdx = getIndex(config?.after);

      // TRUE branch boundaries
      const trueBoundaries = [falseIdx, afterIdx, sortedSteps.length].filter(idx => idx > trueIdx);
      const trueEnd = trueBoundaries.length > 0 ? Math.min(...trueBoundaries) : -1;
      
      if (trueIdx !== -1 && trueEnd !== -1) {
        const trueTailIdx = trueEnd - 1;
        if (trueTailIdx >= trueIdx) {
          stepTargetMap.set(sortedSteps[trueTailIdx].id, config?.after || null);
        }
      }

      // FALSE branch boundaries
      const falseBoundaries = [afterIdx, sortedSteps.length].filter(idx => idx > falseIdx);
      const falseEnd = falseBoundaries.length > 0 ? Math.min(...falseBoundaries) : -1;

      if (falseIdx !== -1 && falseEnd !== -1) {
        const falseTailIdx = falseEnd - 1;
        if (falseTailIdx >= falseIdx) {
          stepTargetMap.set(sortedSteps[falseTailIdx].id, config?.after || null);
        }
      }
    }
  });

  // Generate Normal Edges
  sortedSteps.forEach((step) => {
    if (step.step_type === 'conditional_branch') return;
    
    const targetId = stepTargetMap.get(step.id);
    if (targetId) {
      edges.push({
        id: `e-${step.id}-${targetId}`,
        source: step.id,
        target: targetId
      });
    }
  });

  // Generate Conditional Edges
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
      }
      if (config?.if_false) {
        edges.push({
          id: `e-${step.id}-false-${config.if_false}`,
          source: step.id,
          sourceHandle: 'false',
          target: config.if_false,
          style: { stroke: '#ef4444' }
        })
      }
    }
  })

  return { nodes, edges }
}
