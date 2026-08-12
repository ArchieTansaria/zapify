import { validateAndSerializeGraph } from './src/app/app/workflows/lib/validation.ts';
import { Node, Edge } from '@xyflow/react';

const nodes: Node[] = [
  { id: '1', type: 'actionNode', data: { name: 'LLM', step_type: 'llm_call', config: {} }, position: { x: 0, y: 0 } },
  { id: '2', type: 'conditional_branch', data: { name: 'Conditional', step_type: 'conditional_branch', config: {} }, position: { x: 0, y: 100 } },
  { id: '3', type: 'actionNode', data: { name: 'Notify', step_type: 'notify', config: {} }, position: { x: -100, y: 200 } },
  { id: '4', type: 'actionNode', data: { name: 'LLM Call', step_type: 'llm_call', config: {} }, position: { x: 100, y: 200 } }
];

const edges: Edge[] = [
  { id: 'e-1-2', source: '1', target: '2' },
  { id: 'e-2-true', source: '2', target: '3', sourceHandle: 'true' },
  { id: 'e-2-false', source: '2', target: '4', sourceHandle: 'false' }
];

const { steps, error } = validateAndSerializeGraph(nodes, edges);
if (error) {
  console.error("Error:", error);
} else {
  console.log("Steps array:");
  console.log(JSON.stringify(steps, null, 2));
}
