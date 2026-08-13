import { Node, Edge } from "@xyflow/react"
import { WorkflowStep, WorkflowTrigger } from "@/lib/graphql/workflows"

export function validateAndSerializeGraph(nodes: Node[], edges: Edge[]): { steps: WorkflowStep[], triggers: WorkflowTrigger[], error?: string } {
  // console.log("=== VALIDATION INPUT ===");
  // console.log(
  //   "NODES:",
  //   JSON.stringify(
  //     nodes.map(n => ({
  //       id: n.id,
  //       type: n.type,
  //       stepType: n.data?.step_type,
  //       label: n.data?.label || n.data?.name
  //     })),
  //     null,
  //     2
  //   )
  // );

  // CRITICAL FIX: React Flow's controlled state often retains "phantom edges" 
  // after a node is deleted. We must strictly filter out any edges that point
  // to nodes that no longer exist in the nodes array.
  const validNodeIds = new Set(nodes.map(n => n.id));
  const validEdges = edges.filter(e => validNodeIds.has(e.source) && validNodeIds.has(e.target));

  // console.log(
  //   "EDGES:",
  //   JSON.stringify(
  //     validEdges.map(e => ({
  //       id: e.id,
  //       source: e.source,
  //       sourceHandle: e.sourceHandle,
  //       target: e.target,
  //       targetHandle: e.targetHandle
  //     })),
  //     null,
  //     2
  //   )
  // );
  // console.log("=== END VALIDATION INPUT ===");

  const triggerNodes = nodes.filter(n => n.type === 'triggerNode');
  if (triggerNodes.length > 1) {
    return { steps: [], triggers: [], error: "This connection pattern cannot be represented by the current workflow runner. At most one trigger node is allowed." };
  }

  const outEdges = new Map<string, Edge[]>();
  const inEdges = new Map<string, Edge[]>();
  
  validEdges.forEach(e => {
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
  validEdges.forEach(e => {
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
      config: { ...(n.data.config as any), _ui: { position: n.position } }
    };
  });

  // Filter out trigger from steps
  const stepNodes = sortedNodes.filter(n => n.type !== 'triggerNode');
  
  // Build the steps array
  const steps: WorkflowStep[] = stepNodes.map((n, index) => {
    const outs = outEdges.get(n.id) || [];
    const config = { ...(n.data.config as any) };

    if (n.type === 'conditionalNode') {
      const trueEdge = outs.find(e => e.sourceHandle === 'true');
      const falseEdge = outs.find(e => e.sourceHandle === 'false');
      
      config.if_true = trueEdge ? trueEdge.target : null;
      config.if_false = falseEdge ? falseEdge.target : null;
      
      const getReachable = (startId: string | null) => {
        const reachable = new Set<string>();
        if (!startId) return reachable;
        const queue = [startId];
        while (queue.length > 0) {
          const curr = queue.shift()!;
          if (reachable.has(curr)) continue;
          reachable.add(curr);
          const outs = outEdges.get(curr) || [];
          for (const e of outs) {
            queue.push(e.target);
          }
        }
        return reachable;
      };

      const tReachable = getReachable(config.if_true);
      const fReachable = getReachable(config.if_false);

      let after = null;
      if (config.if_true && config.if_false) {
        const queue: string[] = [];
        if (config.if_true) queue.push(config.if_true);
        if (config.if_false) queue.push(config.if_false);
        const visited = new Set<string>();

        while (queue.length > 0) {
          const curr = queue.shift()!;
          if (visited.has(curr)) continue;
          visited.add(curr);

          if (tReachable.has(curr) && fReachable.has(curr)) {
            const incoming = inEdges.get(curr) || [];
            let hasTrueIncoming = false;
            let hasFalseIncoming = false;

            for (const e of incoming) {
              if (e.source === config.if_true || tReachable.has(e.source)) hasTrueIncoming = true;
              if (e.source === config.if_false || fReachable.has(e.source)) hasFalseIncoming = true;
            }

            if (hasTrueIncoming && hasFalseIncoming) {
              after = curr;
              break;
            }
          }

          const outs = outEdges.get(curr) || [];
          for (const e of outs) {
            queue.push(e.target);
          }
        }
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

      const getReachable = (startId: string | null) => {
        const reachable = new Set<string>();
        if (!startId) return reachable;
        const queue = [startId];
        while (queue.length > 0) {
          const curr = queue.shift()!;
          if (reachable.has(curr)) continue;
          reachable.add(curr);
          const outs = outEdges.get(curr) || [];
          for (const e of outs) {
            queue.push(e.target);
          }
        }
        return reachable;
      };

      const tReachable = getReachable(tTarget);
      const fReachable = getReachable(fTarget);

      if (tTarget && fTarget) {
        let merge = null;
        
        const queue: string[] = [];
        if (tTarget) queue.push(tTarget);
        if (fTarget) queue.push(fTarget);
        const visited = new Set<string>();

        while (queue.length > 0) {
          const curr = queue.shift()!;
          if (visited.has(curr)) continue;
          visited.add(curr);

          if (tReachable.has(curr) && fReachable.has(curr)) {
            const incoming = inEdges.get(curr) || [];
            let hasTrueIncoming = false;
            let hasFalseIncoming = false;

            for (const e of incoming) {
              if (e.source === tTarget || tReachable.has(e.source)) hasTrueIncoming = true;
              if (e.source === fTarget || fReachable.has(e.source)) hasFalseIncoming = true;
            }

            if (hasTrueIncoming && hasFalseIncoming) {
              merge = curr;
              break;
            }
          }

          const outs = outEdges.get(curr) || [];
          for (const e of outs) {
            queue.push(e.target);
          }
        }

        if (!merge) {
          return { steps: [], triggers: [], error: `This connection pattern cannot be represented by the current workflow runner. True and False branches from condition "${node.data.label || node.data.name}" must eventually merge at the same node.` };
        }
      }
    }
  }

  return { steps, triggers };
}
