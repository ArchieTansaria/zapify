import { validateAndSerializeGraph } from '../../src/app/app/workflows/lib/validation.ts';

const nodes = [
  {
    id: "trigger-123",
    type: "triggerNode",
    data: {
      step_type: "webhook",
      name: "Webhook Trigger",
      label: "Webhook Trigger"
    },
    position: { x: 0, y: 0 }
  },
  {
    id: "cond-123",
    type: "conditionalNode",
    data: {
      step_type: "conditional_branch",
      name: "New conditional branch",
      label: "New conditional branch"
    },
    position: { x: 0, y: 100 }
  },
  {
    id: "notify-123",
    type: "actionNode",
    data: {
      step_type: "notify",
      name: "Notify",
      label: "Notify"
    },
    position: { x: -100, y: 200 }
  },
  {
    id: "llm-123",
    type: "actionNode",
    data: {
      step_type: "llm_call",
      name: "LLM",
      label: "LLM"
    },
    position: { x: 100, y: 200 }
  },
  {
    id: "join-123",
    type: "actionNode",
    data: {
      step_type: "db_write",
      name: "JOIN",
      label: "JOIN"
    },
    position: { x: 0, y: 300 }
  }
];

const edges = [
  {
    id: "e-trigger-123-cond-123",
    source: "trigger-123",
    sourceHandle: null,
    target: "cond-123",
    targetHandle: null
  },
  {
    id: "e-cond-123-true-notify-123",
    source: "cond-123",
    sourceHandle: "true",
    target: "notify-123",
    targetHandle: null
  },
  {
    id: "e-cond-123-false-llm-123",
    source: "cond-123",
    sourceHandle: "false",
    target: "llm-123",
    targetHandle: null
  },
  {
    id: "e-notify-123-join-123",
    source: "notify-123",
    sourceHandle: null,
    target: "join-123",
    targetHandle: null
  },
  {
    id: "e-llm-123-join-123",
    source: "llm-123",
    sourceHandle: null,
    target: "join-123",
    targetHandle: null
  }
];

const res = validateAndSerializeGraph(nodes, edges);
console.log("\nFINAL VALIDATION RESULT:");
console.log(JSON.stringify(res, null, 2));
