import crypto from 'crypto';
import { generateJWT } from './utils/manual_jwt.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const GRAPHQL_URL = 'https://local.hasura.local.nhost.run/v1/graphql';
const ADMIN_SECRET = 'nhost-admin-secret';

let tokens = {};
let ids = {};
let orgA;
let allPass = true;

function printResult(name, pass) {
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}`);
  if (!pass) allPass = false;
  return pass;
}

async function getTokens() {
  ids['Alice'] = "723d675a-ea86-4942-9869-7168fb983f36"; // Owner
  ids['Bob'] = "03f87d98-b856-4761-825b-7dea4f1e1ee9"; // Editor
  ids['Carol'] = "b7f05cf7-e896-44a9-a1a9-bde33d56d1d5"; // Viewer
  ids['Dave'] = "a9c6a945-8e89-4c47-a796-076f6fd20b84"; // Org B Owner
  
  tokens['Alice'] = generateJWT(ids['Alice']);
  tokens['Bob'] = generateJWT(ids['Bob']);
  tokens['Carol'] = generateJWT(ids['Carol']);
  tokens['Dave'] = generateJWT(ids['Dave']);
}

async function gql(query, variables, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    headers['x-hasura-admin-secret'] = ADMIN_SECRET;
  }
  
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables })
  });
  const data = await res.json();
  if (data.errors) {
    throw new Error(data.errors[0].message);
  }
  return data.data;
}

async function setup() {
  await getTokens();
  const data = await gql(`
    query { organizations(order_by: { name: asc }) { id name } }
  `);
  orgA = data.organizations.find(o => o.name === 'Org A').id;
}

async function runTests() {
  await setup();
  console.log("\nRunning M4.4a Builder Security Tests...\n");

  const createMut = `
    mutation CreateWorkflow($orgId: uuid!, $name: String!) {
      insert_workflows_one(object: { org_id: $orgId, name: $name }) { id name }
    }
  `;
  const wfRes = await gql(createMut, { orgId: orgA, name: 'Builder Test Workflow' }, tokens.Alice);
  const wfId = wfRes.insert_workflows_one.id;

  const createStepMut = `
    mutation CreateStep($workflowId: uuid!, $type: step_type!, $name: String!, $order: Int!, $config: jsonb!) {
      insert_workflow_steps_one(object: { workflow_id: $workflowId, step_type: $type, name: $name, step_order: $order, config: $config }) { id }
    }
  `;
  const updateStepMut = `
    mutation UpdateStep($id: uuid!, $name: String!, $config: jsonb!, $order: Int!) {
      update_workflow_steps_by_pk(pk_columns: { id: $id }, _set: { name: $name, config: $config, step_order: $order }) { id name step_order }
    }
  `;
  const deleteStepMut = `
    mutation DeleteStep($id: uuid!) { delete_workflow_steps_by_pk(id: $id) { id } }
  `;
  
  // 1. Owner can create a step
  let aliceStep;
  try {
    const res = await gql(createStepMut, { workflowId: wfId, type: 'llm_call', name: 'Alice Step 1', order: 0, config: {} }, tokens.Alice);
    aliceStep = res.insert_workflow_steps_one.id;
    printResult('1. Owner can create a step', !!aliceStep);
  } catch (e) {
    printResult('1. Owner can create a step', false);
  }

  // 2. Owner can update a step
  try {
    const res = await gql(updateStepMut, { id: aliceStep, name: 'Alice Step Renamed', order: 0, config: { prompt: "Test" } }, tokens.Alice);
    printResult('2. Owner can update a step', res.update_workflow_steps_by_pk?.name === 'Alice Step Renamed');
  } catch (e) {
    printResult('2. Owner can update a step', false);
  }

  // 3. Owner can reorder steps
  try {
    const res = await gql(updateStepMut, { id: aliceStep, name: 'Alice Step Renamed', order: 1, config: { prompt: "Test" } }, tokens.Alice);
    printResult('4. Owner can reorder steps', res.update_workflow_steps_by_pk?.step_order === 1);
  } catch (e) {
    printResult('4. Owner can reorder steps', false);
  }
  
  // 5. Editor behavior
  let bobStep;
  try {
    const res = await gql(createStepMut, { workflowId: wfId, type: 'http_request', name: 'Bob Step', order: 2, config: {} }, tokens.Bob);
    bobStep = res.insert_workflow_steps_one.id;
    printResult('5. Editor can create a step', !!bobStep);
  } catch (e) {
    printResult('5. Editor can create a step', false);
  }

  // 6. Viewer cannot mutate
  try {
    await gql(createStepMut, { workflowId: wfId, type: 'llm_call', name: 'Carol Step', order: 3, config: {} }, tokens.Carol);
    printResult('6. Viewer cannot mutate workflow steps', false);
  } catch (e) {
    printResult('6. Viewer cannot mutate workflow steps', true);
  }

  // 7. Cross-org user cannot mutate Org A
  try {
    await gql(createStepMut, { workflowId: wfId, type: 'llm_call', name: 'Dave Step', order: 3, config: {} }, tokens.Dave);
    printResult('7. Cross-org user cannot mutate Org A workflow steps', false);
  } catch (e) {
    printResult('7. Cross-org user cannot mutate Org A workflow steps', true);
  }

  // Check JSON config persists correctly (9)
  try {
    const queryStep = `query { workflow_steps_by_pk(id: "${aliceStep}") { config } }`;
    const checkRes = await gql(queryStep, {}, tokens.Alice);
    printResult('9. JSON config persists correctly', checkRes.workflow_steps_by_pk.config.prompt === "Test");
  } catch (e) {
    printResult('9. JSON config persists correctly', false);
  }

  // 3. Owner can delete a step
  try {
    const res = await gql(deleteStepMut, { id: aliceStep }, tokens.Alice);
    printResult('3. Owner can delete a step', !!res.delete_workflow_steps_by_pk);
  } catch (e) {
    printResult('3. Owner can delete a step', false);
  }
  
  // 10. Trigger permissions
  const createTriggerMut = `
    mutation CreateTrigger($workflowId: uuid!, $type: trigger_type!, $config: jsonb!) {
      insert_workflow_triggers_one(object: { workflow_id: $workflowId, trigger_type: $type, config: $config }) { id }
    }
  `;
  try {
    // Owner can create manual
    const r1 = await gql(createTriggerMut, { workflowId: wfId, type: 'manual', config: {} }, tokens.Alice);
    // Editor can create manual
    const r2 = await gql(createTriggerMut, { workflowId: wfId, type: 'manual', config: {} }, tokens.Bob);
    // Editor CANNOT create webhook
    let editorWebhookFailed = false;
    try {
      await gql(createTriggerMut, { workflowId: wfId, type: 'webhook', config: {} }, tokens.Bob);
    } catch (e) {
      editorWebhookFailed = true;
    }
    printResult('10. Trigger permissions remain consistent with M2', !!r1 && !!r2 && editorWebhookFailed);
  } catch (e) {
    printResult('10. Trigger permissions remain consistent with M2', false);
  }

  console.log(`\nOverall: ${allPass ? 'PASS' : 'FAIL'}`);
  process.exit(allPass ? 0 : 1);
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
