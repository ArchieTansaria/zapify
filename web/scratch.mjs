import { validateAndSerializeGraph } from "./src/app/app/workflows/lib/validation.ts"

const nodes = [
  { id: 'cond1', type: 'conditionalNode', data: { name: 'New conditional branch', label: 'New conditional branch', config: {} } },
  { id: 'notify1', type: 'actionNode', data: { name: 'New http request', config: {} } },
  { id: 'llm1', type: 'actionNode', data: { name: 'New db write', config: {} } },
  { id: 'join1', type: 'actionNode', data: { name: 'New approval gate', config: {} } }
];

const edges = [
  { id: 'e1', source: 'cond1', sourceHandle: 'true', target: 'notify1' },
  { id: 'e2', source: 'cond1', sourceHandle: 'false', target: 'llm1' },
  { id: 'e3', source: 'notify1', target: 'join1' },
  { id: 'e4', source: 'llm1', target: 'join1' }
];

console.log(validateAndSerializeGraph(nodes, edges));
