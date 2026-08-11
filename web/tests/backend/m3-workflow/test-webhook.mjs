import { generateJWT } from '../../utils/manual_jwt.js';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import crypto from 'crypto';

const GRAPHQL_URL = 'https://local.hasura.local.nhost.run/v1/graphql';
const AUTH_URL = 'https://local.auth.local.nhost.run/v1/signin/email-password';
const ADMIN_SECRET = 'nhost-admin-secret';

const users = [
  { name: 'Alice', email: 'alice@test.com', password: 'password123' },
  { name: 'Bob', email: 'bob@test.com', password: 'password123' },
  { name: 'Carol', email: 'carol@test.com', password: 'password123' },
];

let tokens = {};
let ids = {};
let orgA;

async function getTokens() {
  ids['Alice'] = "723d675a-ea86-4942-9869-7168fb983f36";
  ids['Bob'] = "03f87d98-b856-4761-825b-7dea4f1e1ee9";
  ids['Carol'] = "b7f05cf7-e896-44a9-a1a9-bde33d56d1d5";
  ids['Dave'] = "a9c6a945-8e89-4c47-a796-076f6fd20b84";
  tokens['Alice'] = generateJWT(ids['Alice']);
  tokens['Bob'] = generateJWT(ids['Bob']);
  tokens['Carol'] = generateJWT(ids['Carol']);
  tokens['Dave'] = generateJWT(ids['Dave']);
}

async function graphql(query, variables = {}, asUser = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (asUser === 'ADMIN') {
    headers['x-hasura-admin-secret'] = ADMIN_SECRET;
  } else if (asUser) {
    headers['Authorization'] = `Bearer ${tokens[asUser]}`;
  } // else public (no auth header)

  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables })
  });
  return await res.json();
}

async function executeWebhookAction(workflowId, payload, secretHeader) {
  const query = `
    mutation WebhookTrigger($workflow_id: uuid!, $payload: jsonb) {
      triggerWorkflowWebhook(workflow_id: $workflow_id, payload: $payload) {
        success
        run_id
        status
      }
    }
  `;
  const headers = { 'Content-Type': 'application/json' };
  if (secretHeader !== null) {
    headers['x-zapify-webhook-secret'] = secretHeader;
  }

  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables: { workflow_id: workflowId, payload } })
  });
  return await res.json();
}

async function setup() {
  await getTokens();
  console.log("Debug IDs:", ids);
  const q = `query { organizations(where: { name: {_eq: "Org A"}}) { id } }`;
  const res = await graphql(q, {}, 'ADMIN');
  orgA = res.data.organizations[0].id;

  // Ensure these users are the members of Org A
  const insertMembersQ = `
    mutation($org_id: uuid!, $alice: uuid!, $bob: uuid!, $carol: uuid!) {
      delete_org_members(where: {org_id: {_eq: $org_id}}) { affected_rows }
      insert_org_members(objects: [
        {org_id: $org_id, user_id: $alice, role: "owner"},
        {org_id: $org_id, user_id: $bob, role: "editor"},
        {org_id: $org_id, user_id: $carol, role: "viewer"}
      ]) { affected_rows }
    }
  `;
  await graphql(insertMembersQ, {
    org_id: orgA,
    alice: ids['Alice'],
    bob: ids['Bob'],
    carol: ids['Carol']
  }, 'ADMIN');
}

async function createWorkflow(name) {
  const m = `mutation { insert_workflows_one(object: {org_id: "${orgA}", name: "${name}"}) { id } }`;
  const res = await graphql(m, {}, 'ADMIN');
  return res.data.insert_workflows_one.id;
}

async function addStep(workflowId, type, name, order, config) {
  const m = `mutation($config: jsonb!) { insert_workflow_steps_one(object: {workflow_id: "${workflowId}", step_type: "${type}", name: "${name}", step_order: ${order}, config: $config}) { id } }`;
  const res = await graphql(m, { config }, 'ADMIN');
  return res.data.insert_workflow_steps_one.id;
}

async function addWebhookTrigger(workflowId, secretHash, asUser) {
  const configStr = JSON.stringify({ secretHash }).replace(/"/g, '\\"');
  const m = `mutation { insert_workflow_triggers_one(object: {workflow_id: "${workflowId}", trigger_type: "webhook", config: "${configStr}"}) { id } }`;
  return await graphql(m, {}, asUser);
}

async function getRun(runId) {
  const q = `query {
    workflow_runs_by_pk(id: "${runId}") {
      status
      trigger_type
      error
      step_runs(order_by: {step_order: asc}) {
        id
        status
        workflow_step_id
        input
        output
      }
    }
  }`;
  const res = await graphql(q, {}, 'ADMIN');
  return res.data.workflow_runs_by_pk;
}

async function setQuota(used, limit) {
  const m = `mutation { update_organizations_by_pk(pk_columns: {id: "${orgA}"}, _set: {quota_used: ${used}, quota_limit: ${limit}}) { id } }`;
  await graphql(m, {}, 'ADMIN');
}

async function approve(stepRunId, user) {
  const query = `
    mutation {
      approveStep(step_run_id: "${stepRunId}") {
        success
        run_id
        status
      }
    }
  `;
  return await graphql(query, {}, user);
}

function printResult(name, pass) {
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name} `);
  return pass;
}

async function main() {
  let allPass = true;
  console.log('══════════════════════════════════════');
  console.log('       ZAPIFY M3.5 WEBHOOK TESTS      ');
  console.log('══════════════════════════════════════\\n');

  try {
    await setup();
    
    // ----------------------------------------------------
    // Test 10: webhook does not bypass M2 (Config permissions)
    // ----------------------------------------------------
    const wf10 = await createWorkflow("M3.5: Permissions");
    const testSecret = "secret-10";
    const testHash = crypto.createHash('sha256').update(testSecret).digest('hex');
    
    const carolRes = await addWebhookTrigger(wf10, testHash, 'Carol');
    let p10a = carolRes.errors && carolRes.errors[0].message.includes('permission');
    
    const bobRes = await addWebhookTrigger(wf10, testHash, 'Bob');
    let p10b = bobRes.errors && bobRes.errors[0].message.includes('permission');
    
    const aliceRes = await addWebhookTrigger(wf10, testHash, 'Alice');
    if (aliceRes.errors) console.log("Debug AliceRes:", JSON.stringify(aliceRes.errors, null, 2));
    let p10c = !aliceRes.errors && aliceRes.data?.insert_workflow_triggers_one?.id;
    
    allPass = printResult('Test 10: webhook does not bypass M2 permissions (viewer/editor denied, owner allowed)', p10a && p10b && p10c) && allPass;
    
    // ----------------------------------------------------
    // Test 1, 2, 8: Valid webhook starts run, reaches context, has trigger_type = webhook
    // ----------------------------------------------------
    const wf1 = await createWorkflow("M3.5: Valid Webhook");
    await addStep(wf1, 'llm_call', 'Step1', 1, { prompt: "Payload received: {{previous_output}}", stub_output: "Processed payload" });
    const secret1 = "my-awesome-secret-1";
    const hash1 = crypto.createHash('sha256').update(secret1).digest('hex');
    await addWebhookTrigger(wf1, hash1, 'Alice');
    
    const payload1 = { customer: 'acme' };
    const hookRes1 = await executeWebhookAction(wf1, payload1, secret1);
    if (hookRes1.errors) console.log("Debug HookRes1:", JSON.stringify(hookRes1.errors, null, 2));
    
    let p1 = hookRes1.data?.triggerWorkflowWebhook?.success;
    const runId1 = hookRes1.data?.triggerWorkflowWebhook?.run_id;
    if (!runId1) console.log("Debug runId1 is undefined");
    
    await new Promise(r => setTimeout(r, 2000)); // wait for execution
    
    const run1 = await getRun(runId1);
    p1 = p1 && run1.status === 'completed';
    allPass = printResult('Test 1: webhook trigger starts workflow', p1) && allPass;
    
    let p8 = run1.trigger_type === 'webhook';
    allPass = printResult('Test 8: trigger_type = webhook', p8) && allPass;
    
    let p2 = run1.step_runs[0].input?.previousOutput?.customer === 'acme';
    allPass = printResult('Test 2: webhook payload reaches workflow context', p2) && allPass;
    
    // ----------------------------------------------------
    // Test 3: Invalid secret -> rejected
    // ----------------------------------------------------
    const hookRes3 = await executeWebhookAction(wf1, {}, "wrong-secret");
    let p3 = hookRes3.errors && hookRes3.errors[0].message.includes('Unauthorized');
    allPass = printResult('Test 3: invalid secret -> rejected', p3) && allPass;

    // ----------------------------------------------------
    // Test 4: Missing secret -> rejected
    // ----------------------------------------------------
    const hookRes4 = await executeWebhookAction(wf1, {}, null);
    let p4 = hookRes4.errors && hookRes4.errors[0].message.includes('Unauthorized');
    allPass = printResult('Test 4: missing secret -> rejected', p4) && allPass;

    // ----------------------------------------------------
    // Test 5: Guessed workflow ID + invalid secret -> rejected
    // ----------------------------------------------------
    // We use a fake workflow ID. We should get 401 (or 404), but definitely not 200.
    const fakeId = crypto.randomUUID();
    const hookRes5 = await executeWebhookAction(fakeId, {}, "random");
    let p5 = hookRes5.errors && hookRes5.errors.length > 0;
    allPass = printResult('Test 5: invalid workflow ID + invalid secret -> rejected', p5) && allPass;

    // ----------------------------------------------------
    // Test 6: Workflow without webhook trigger -> rejected
    // ----------------------------------------------------
    const wf6 = await createWorkflow("M3.5: Manual Only");
    // No webhook trigger added
    const hookRes6 = await executeWebhookAction(wf6, {}, "some-secret");
    let p6 = hookRes6.errors && hookRes6.errors[0].message.includes('Workflow not found');
    allPass = printResult('Test 6: workflow without webhook trigger -> rejected', p6) && allPass;

    // ----------------------------------------------------
    // Test 7: Quota exhausted -> rejected
    // ----------------------------------------------------
    await setQuota(1000, 1000); // exhausted
    const hookRes7 = await executeWebhookAction(wf1, {}, secret1);
    let p7 = hookRes7.errors && hookRes7.errors[0].message.includes('Quota exhausted');
    allPass = printResult('Test 7: quota exhausted -> rejected', p7) && allPass;
    await setQuota(0, 1000); // restore quota
    
    // ----------------------------------------------------
    // Test 9: Approval gate through webhook pauses properly
    // ----------------------------------------------------
    const wf9 = await createWorkflow("M3.5: Webhook Approval");
    await addStep(wf9, 'llm_call', 'Step1', 1, {});
    const s9gate = await addStep(wf9, 'approval_gate', 'Gate', 2, {});
    await addStep(wf9, 'http_request', 'Step3', 3, { url: "https://example.com" });
    
    const secret9 = "approval-secret";
    const hash9 = crypto.createHash('sha256').update(secret9).digest('hex');
    await addWebhookTrigger(wf9, hash9, 'Alice');
    
    const hookRes9 = await executeWebhookAction(wf9, {}, secret9);
    const runId9 = hookRes9.data?.triggerWorkflowWebhook?.run_id;
    
    await new Promise(r => setTimeout(r, 1500));
    
    let run9 = await getRun(runId9);
    let p9a = run9.status === 'paused' && run9.step_runs.length === 2 && run9.step_runs[1].status === 'waiting_for_approval';
    if (!p9a) console.log("Debug 9a:", run9);
    
    // Approve it manually with Alice (owner)
    const approveRes = await approve(run9.step_runs[1].id, 'Alice');
    if (approveRes.errors) console.log("Debug ApproveRes:", JSON.stringify(approveRes.errors));
    
    await new Promise(r => setTimeout(r, 2000));
    run9 = await getRun(runId9);
    
    let p9b = run9.status === 'completed' && run9.step_runs.length === 3 && run9.step_runs[2].status === 'completed';
    if (!p9b) console.log("Debug 9b:", run9);
    
    allPass = printResult('Test 9: approval gate works for webhook-started workflows', p9a && p9b) && allPass;

    // ----------------------------------------------------
    // Test 11: Webhook cannot modify execution state directly
    // ----------------------------------------------------
    // Try to mutate step_runs as public
    const mutState = `mutation { update_step_runs(where: {}, _set: {status: "completed"}) { affected_rows } }`;
    const resMut = await graphql(mutState, {});
    let p11 = resMut.errors && resMut.errors.length > 0;
    allPass = printResult('Test 11: webhook cannot modify execution state directly', p11) && allPass;

  } catch (e) {
    console.error("Test execution failed:", e);
    allPass = false;
  }

  console.log('\\n══════════════════════════════════════');
  console.log(`RESULT: ${allPass ? 'PASS' : 'FAIL'}`);
  console.log('══════════════════════════════════════\\n');
  process.exit(allPass ? 0 : 1);
}

main();
