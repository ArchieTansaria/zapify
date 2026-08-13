const edges = [
  { source: 'cond1', sourceHandle: 'true', target: 'notify1' },
  { source: 'cond1', sourceHandle: 'false', target: 'llm1' },
  { source: 'notify1', target: 'join1' },
  { source: 'llm1', target: 'join1' },
  { source: 'join1', target: 'end1' }
];

const outEdges = new Map();
edges.forEach(e => {
  if (!outEdges.has(e.source)) outEdges.set(e.source, []);
  outEdges.get(e.source).push(e);
});

function getReachable(startId) {
  const reachable = new Set();
  const queue = [startId];
  while (queue.length > 0) {
    const curr = queue.shift();
    if (!curr || reachable.has(curr)) continue;
    reachable.add(curr);
    const outs = outEdges.get(curr) || [];
    for (const e of outs) {
      queue.push(e.target);
    }
  }
  return reachable;
}

const tReachable = getReachable('notify1');
const fReachable = getReachable('llm1');

console.log("tReachable", tReachable);
console.log("fReachable", fReachable);

// Assuming sortedNodes is ['cond1', 'notify1', 'llm1', 'join1', 'end1']
const sortedNodeIds = ['cond1', 'notify1', 'llm1', 'join1', 'end1'];

let merge = null;
for (const id of sortedNodeIds) {
  if (tReachable.has(id) && fReachable.has(id)) {
    merge = id;
    break;
  }
}
console.log("merge", merge);
