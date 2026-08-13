function findMerge(nodes, edges, conditionalId) {
  // get outEdges mapping
  const outEdges = new Map();
  edges.forEach(e => {
    if (!outEdges.has(e.source)) outEdges.set(e.source, []);
    outEdges.get(e.source).push(e);
  });

  const inEdges = new Map();
  edges.forEach(e => {
    if (!inEdges.has(e.target)) inEdges.set(e.target, []);
    inEdges.get(e.target).push(e);
  });

  const outs = outEdges.get(conditionalId) || [];
  const tEdge = outs.find(e => e.sourceHandle === 'true');
  const fEdge = outs.find(e => e.sourceHandle === 'false');
  
  const tTarget = tEdge ? tEdge.target : null;
  const fTarget = fEdge ? fEdge.target : null;

  // walk downstream
  const getReachableNodes = (startId) => {
    const reachable = new Set();
    if (!startId) return reachable;
    const queue = [startId];
    while(queue.length > 0) {
      const curr = queue.shift();
      if (reachable.has(curr)) continue;
      reachable.add(curr);
      const nodeOuts = outEdges.get(curr) || [];
      for (const edge of nodeOuts) {
        queue.push(edge.target);
      }
    }
    return reachable;
  }

  const tReachable = getReachableNodes(tTarget);
  const fReachable = getReachableNodes(fTarget);

  let merge = null;
  
  // To find the first one in actual graph distance, we can do a BFS starting from the conditional node
  // Or we can just use the topological sort.
  // Wait, the prompt says:
  // "candidate has incoming connectivity from both branch sides"
  // This means the candidate must have an incoming path from TRUE and an incoming path from FALSE.
  // "The first such candidate in actual graph distance should be the merge."

  const queue = [];
  if (tTarget) queue.push(tTarget);
  if (fTarget) queue.push(fTarget);
  
  const visited = new Set();
  
  while(queue.length > 0) {
    const curr = queue.shift();
    if (visited.has(curr)) continue;
    visited.add(curr);
    
    // Check if it's a merge
    if (tReachable.has(curr) && fReachable.has(curr)) {
      // It must have incoming connectivity from both branch sides.
      // This means the path from tTarget -> curr exists, AND fTarget -> curr exists.
      // tReachable contains all nodes reachable from tTarget. 
      // If curr is in tReachable, a path exists.
      // So if it's in both, it's a merge!
      merge = curr;
      break;
    }
    
    const currOuts = outEdges.get(curr) || [];
    for (const edge of currOuts) {
      queue.push(edge.target);
    }
  }

  return { tTarget, fTarget, tReachable, fReachable, merge };
}

const edges1 = [
    { source: "cond", sourceHandle: "true", target: "notify" },
    { source: "cond", sourceHandle: "false", target: "llm" },
    { source: "notify", target: "join" },
    { source: "llm", target: "join" }
];
console.log("Test 1:", findMerge([], edges1, "cond"));

const edges2 = [
    { source: "cond", sourceHandle: "true", target: "A" },
    { source: "A", target: "B" },
    { source: "B", target: "JOIN" },
    { source: "cond", sourceHandle: "false", target: "C" },
    { source: "C", target: "D" },
    { source: "D", target: "JOIN" }
];
console.log("Test 2:", findMerge([], edges2, "cond"));

const edges3 = [
    { source: "cond", sourceHandle: "true", target: "A" },
    { source: "A", target: "JOIN" },
    { source: "cond", sourceHandle: "false", target: "B" },
    { source: "B", target: "C" },
    { source: "C", target: "JOIN" }
];
console.log("Test 3:", findMerge([], edges3, "cond"));

