import { validateAndSerializeGraph } from "../../src/app/app/workflows/lib/validation.ts"

function mockNodes(ids) {
  return ids.map((id, index) => {
    let type = 'actionNode';
    if (id === 'cond') type = 'conditionalNode';
    if (id === 'trigger') type = 'triggerNode';
    return { id, type, data: { name: id, label: id, config: {} }, position: { x: 0, y: index * 100 } };
  });
}

function runTest(name, nodeIds, edges, expectedError = null) {
  const nodes = mockNodes(nodeIds);
  const result = validateAndSerializeGraph(nodes, edges);
  if (expectedError) {
    if (result.error === expectedError || (result.error && result.error.includes(expectedError))) {
      console.log(`[PASS] ${name}`);
    } else {
      console.error(`[FAIL] ${name} - Expected error containing "${expectedError}", got "${result.error}"`);
    }
  } else {
    if (result.error) {
      console.error(`[FAIL] ${name} - Unexpected error: ${result.error}`);
    } else {
      console.log(`[PASS] ${name}`);
    }
  }
}

// Test 1: exact graph
runTest(
  "Exact graph (Notify -> JOIN, LLM -> JOIN)",
  ['trigger', 'cond', 'notify', 'llm', 'join'],
  [
    { id: 'e0', source: 'trigger', target: 'cond' },
    { id: 'e1', source: 'cond', sourceHandle: 'true', target: 'notify' },
    { id: 'e2', source: 'cond', sourceHandle: 'false', target: 'llm' },
    { id: 'e3', source: 'notify', target: 'join' },
    { id: 'e4', source: 'llm', target: 'join' }
  ]
);

// Test 2: multi-node branches
runTest(
  "Multi-node branches",
  ['trigger', 'cond', 'notify', 'A', 'llm', 'B', 'join'],
  [
    { id: 'e0', source: 'trigger', target: 'cond' },
    { id: 'e1', source: 'cond', sourceHandle: 'true', target: 'notify' },
    { id: 'e2', source: 'notify', target: 'A' },
    { id: 'e3', source: 'A', target: 'join' },
    { id: 'e4', source: 'cond', sourceHandle: 'false', target: 'llm' },
    { id: 'e5', source: 'llm', target: 'B' },
    { id: 'e6', source: 'B', target: 'join' }
  ]
);

// Test 3: invalid graph
runTest(
  "Invalid graph (branches do not converge)",
  ['trigger', 'cond', 'notify', 'llm'],
  [
    { id: 'e0', source: 'trigger', target: 'cond' },
    { id: 'e1', source: 'cond', sourceHandle: 'true', target: 'notify' },
    { id: 'e2', source: 'cond', sourceHandle: 'false', target: 'llm' }
  ],
  "must eventually merge"
);
