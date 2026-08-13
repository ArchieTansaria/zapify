function getMerge(nodes, edges, condId) {
  const outEdges = new Map();
  const inEdges = new Map();
  edges.forEach(e => {
    if (!outEdges.has(e.source)) outEdges.set(e.source, []);
    outEdges.get(e.source).push(e);
    if (!inEdges.has(e.target)) inEdges.set(e.target, []);
    inEdges.get(e.target).push(e);
  });

  const outs = outEdges.get(condId) || [];
  const tEdge = outs.find(e => e.sourceHandle === 'true');
  const fEdge = outs.find(e => e.sourceHandle === 'false');
  
  const tTarget = tEdge ? tEdge.target : null;
  const fTarget = fEdge ? fEdge.target : null;

  // Path from a specific root
  const getReachable = (start) => {
    const reachable = new Set();
    if (!start) return reachable;
    const queue = [start];
    while(queue.length > 0) {
      const curr = queue.shift();
      if (reachable.has(curr)) continue;
      reachable.add(curr);
      const eOuts = outEdges.get(curr) || [];
      for (const edge of eOuts) {
        queue.push(edge.target);
      }
    }
    return reachable;
  };

  const tReachable = getReachable(tTarget);
  const fReachable = getReachable(fTarget);

  let merge = null;
  
  // To find the first one in actual graph distance, we can do BFS from the conditional node
  const queue = [];
  if (tTarget) queue.push(tTarget);
  if (fTarget) queue.push(fTarget);
  const visited = new Set();
  
  while (queue.length > 0) {
    const curr = queue.shift();
    if (visited.has(curr)) continue;
    visited.add(curr);
    
    // Condition 1 & 2: reachable from both branch roots
    if (tReachable.has(curr) && fReachable.has(curr)) {
      // Condition 3: candidate has incoming connectivity from both branch sides
      // That means, at least one incoming edge is from a node in tReachable (or is tTarget)
      // AND at least one incoming edge is from a node in fReachable (or is fTarget)
      
      const incoming = inEdges.get(curr) || [];
      let hasTrueIncoming = false;
      let hasFalseIncoming = false;
      
      for (const e of incoming) {
        if (e.source === tTarget || tReachable.has(e.source)) {
          hasTrueIncoming = true;
        }
        if (e.source === fTarget || fReachable.has(e.source)) {
          hasFalseIncoming = true;
        }
      }
      
      if (hasTrueIncoming && hasFalseIncoming) {
        merge = curr;
        break;
      }
    }
    
    const currOuts = outEdges.get(curr) || [];
    for (const edge of currOuts) {
      queue.push(edge.target);
    }
  }

  return { if_true: tTarget, if_false: fTarget, after: merge };
}

console.log("PHASE 6:", getMerge([], [
    { source: "cond", sourceHandle: "true", target: "notify" },
    { source: "cond", sourceHandle: "false", target: "llm" },
    { source: "notify", target: "join" },
    { source: "llm", target: "join" }
], "cond"));

console.log("PHASE 7 (Multi-node):", getMerge([], [
    { source: "cond", sourceHandle: "true", target: "A" },
    { source: "A", target: "B" },
    { source: "B", target: "JOIN" },
    { source: "cond", sourceHandle: "false", target: "C" },
    { source: "C", target: "D" },
    { source: "D", target: "JOIN" }
], "cond"));

console.log("PHASE 7 (Asymmetric):", getMerge([], [
    { source: "cond", sourceHandle: "true", target: "A" },
    { source: "A", target: "JOIN" },
    { source: "cond", sourceHandle: "false", target: "B" },
    { source: "B", target: "C" },
    { source: "C", target: "JOIN" }
], "cond"));

console.log("PHASE 7 (No merge):", getMerge([], [
    { source: "cond", sourceHandle: "true", target: "A" },
    { source: "cond", sourceHandle: "false", target: "B" }
], "cond"));

