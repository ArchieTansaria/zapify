import { Node, Edge } from "@xyflow/react"
import { WorkflowStep, WorkflowTrigger } from "@/lib/graphql/workflows"

export function validateAndSerializeGraph(nodes: Node[], edges: Edge[]): { steps: WorkflowStep[], triggers: WorkflowTrigger[], error?: string } {
  const triggerNodes = nodes.filter(n => n.type === 'triggerNode');
  if (triggerNodes.length > 1) {
    return { steps: [], triggers: [], error: "This connection pattern cannot be represented by the current workflow runner. At most one trigger node is allowed." };
  }

  const outEdges = new Map<string, Edge[]>();
  const inEdges = new Map<string, Edge[]>();
  
  edges.forEach(e => {
    if (!outEdges.has(e.source)) outEdges.set(e.source, []);
    outEdges.get(e.source)!.push(e);
    
    if (!inEdges.has(e.target)) inEdges.set(e.target, []);
    inEdges.get(e.target)!.push(e);
  });

  // Basic degree validation
  for (const node of nodes) {
    const outs = outEdges.get(node.id) || [];
    if (node.type === 'actionNode' || node.type === 'triggerNode') {
      if (outs.length > 1) {
        return { steps: [], triggers: [], error: `This connection pattern cannot be represented by the current workflow runner. Node "${node.data.label}" can only have one outgoing connection.` };
      }
    }
  }

  // Topological sort to establish step_order
  const inDegree = new Map<string, number>();
  nodes.forEach(n => inDegree.set(n.id, 0));
  edges.forEach(e => {
    inDegree.set(e.target, inDegree.get(e.target)! + 1);
  });

  const queue: string[] = [];
  inDegree.forEach((deg, id) => {
    if (deg === 0) queue.push(id);
  });

  const sortedNodes: Node[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const node = nodes.find(n => n.id === current)!;
    sortedNodes.push(node);

    const outs = outEdges.get(current) || [];
    outs.forEach(e => {
      const deg = inDegree.get(e.target)! - 1;
      inDegree.set(e.target, deg);
      if (deg === 0) queue.push(e.target);
    });
  }

  if (sortedNodes.length !== nodes.length) {
    return { steps: [], triggers: [], error: "This connection pattern cannot be represented by the current workflow runner. Cycles are not supported." };
  }

  const triggers: WorkflowTrigger[] = triggerNodes.map(n => {
    return {
      id: n.id,
      workflow_id: n.data.workflow_id as string,
      trigger_type: n.data.trigger_type as string,
      is_active: n.data.is_active as boolean,
      config: { ...(n.data.config as Record<string, unknown>), _ui: { position: n.position } }
    };
  });

  // Filter out trigger from steps
  const stepNodes = sortedNodes.filter(n => n.type !== 'triggerNode');
  
  // Build the steps array
  const steps: WorkflowStep[] = stepNodes.map((n, index) => {
    const outs = outEdges.get(n.id) || [];
    const config = { ...(n.data.config as Record<string, unknown>) } as Record<string, unknown>;

    if (n.type === 'conditionalNode') {
      const trueEdge = outs.find(e => e.sourceHandle === 'true');
      const falseEdge = outs.find(e => e.sourceHandle === 'false');
      
      config.if_true = trueEdge ? trueEdge.target : null;
      config.if_false = falseEdge ? falseEdge.target : null;
      
      let after = null;
      if (trueEdge) {
        const tOuts = outEdges.get(trueEdge.target) || [];
        if (tOuts.length > 0) after = tOuts[0].target;
      }
      if (!after && falseEdge) {
        const fOuts = outEdges.get(falseEdge.target) || [];
        if (fOuts.length > 0) after = fOuts[0].target;
      }

      config.after = after;
    }

    config._ui = { position: n.position };

    return {
      id: n.id,
      workflow_id: n.data.workflow_id as string,
      step_order: index,
      name: n.data.name as string,
      step_type: n.data.step_type as string,
      config: config
    };
  });

  if (triggerNodes.length === 1) {
    const triggerOut = outEdges.get(triggerNodes[0].id);
    if (!triggerOut || triggerOut.length === 0) {
       if (nodes.length > 1) {
         return { steps: [], triggers: [], error: "This connection pattern cannot be represented by the current workflow runner. Disconnected nodes." };
       }
    }
  } else if (triggerNodes.length === 0 && nodes.length > 0) {
      // We allow saving a graph with no triggers but has steps, as a work in progress.
    // However, if we want to enforce it, we could error here. The user requested empty state if no trigger.
    // It's better to just let it save.
  }

  // Structural Validation for Conditionals
  for (const node of nodes) {
    if (node.type === 'conditionalNode') {
      const outs = outEdges.get(node.id) || [];
      const tEdge = outs.find(e => e.sourceHandle === 'true');
      const fEdge = outs.find(e => e.sourceHandle === 'false');

      const tTarget = tEdge ? tEdge.target : null;
      const fTarget = fEdge ? fEdge.target : null;

      if (!tTarget || !fTarget) {
        return { steps: [], triggers: [], error: `This connection pattern cannot be represented by the current workflow runner. Conditionals must have both TRUE and FALSE connections.` };
      }

      const tTargetOuts = outEdges.get(tTarget) || [];
      const fTargetOuts = outEdges.get(fTarget) || [];

      if (tTargetOuts.length > 1 || fTargetOuts.length > 1) {
        return { steps: [], triggers: [], error: `This connection pattern cannot be represented by the current workflow runner. Branches from condition "${node.data.label}" can only have one node before merging.` };
      }

      const tNext = tTargetOuts.length === 1 ? tTargetOuts[0].target : null;
      const fNext = fTargetOuts.length === 1 ? fTargetOuts[0].target : null;

      const converges = 
        (tTarget === fTarget) || 
        (tNext === fTarget) || 
        (fNext === tTarget) || 
        (tNext !== null && tNext === fNext);

      if (!converges) {
        return { steps: [], triggers: [], error: `This connection pattern cannot be represented by the current workflow runner. Both TRUE and FALSE branches must explicitly converge to the same node.` };
      }
    }
  }

  return { steps, triggers };
}
