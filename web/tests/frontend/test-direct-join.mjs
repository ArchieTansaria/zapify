import { validateAndSerializeGraph } from '../../src/app/app/workflows/lib/validation.ts';

const nodes = [
  { id: "cond", type: "conditionalNode", data: { step_type: "conditional_branch" } },
  { id: "join", type: "actionNode", data: { step_type: "db_write" } }
];

const edges = [
  { id: "e1", source: "cond", sourceHandle: "true", target: "join" },
  { id: "e2", source: "cond", sourceHandle: "false", target: "join" }
];

console.log(validateAndSerializeGraph(nodes, edges));
