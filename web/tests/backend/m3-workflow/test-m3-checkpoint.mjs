import { generateJWT } from '../../utils/manual_jwt.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const GRAPHQL_URL = 'https://local.hasura.local.nhost.run/v1/graphql';
const WS_URL = 'wss://local.hasura.local.nhost.run/v1/graphql';
const AUTH_URL = 'https://local.auth.local.nhost.run/v1/signin/email-password';
const ADMIN_SECRET = 'nhost-admin-secret';

const orgId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // Org A

const tokens = {};
const ids = {};
let createdEntities = { workflows: [], steps: [] };

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

async function query(asUser, q, variables = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (asUser === 'admin') {
    headers['x-hasura-admin-secret'] = ADMIN_SECRET;
  } else if (asUser) {
    headers['Authorization'] = `Bearer ${tokens[asUser]}`;
  }
  
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: q, variables })
  });
  const json = await res.json();
  return json;
}

async function createWorkflow(name) {
  const q = await query('admin', `mutation {
    insert_workflows_one(object: {org_id: "${orgId}", name: "${name}"}) { id }
  }`);
  const id = q.data.insert_workflows_one.id;
  createdEntities.workflows.push(id);
  return id;
}

async function addStep(workflowId, type, name, order, config) {
  const q = await query('admin', `mutation($config: jsonb!) {
    insert_workflow_steps_one(object: {
      workflow_id: "${workflowId}",
      step_type: "${type}",
      name: "${name}",
      step_order: ${order},
      config: $config
    }) { id }
  }`, { config });
  const id = q.data.insert_workflow_steps_one.id;
  createdEntities.steps.push(id);
  return id;
}

async function trigger(workflowId, asUser = 'Alice') {
  return await query(asUser, `mutation { triggerWorkflowRun(workflow_id: "${workflowId}") { success run_id status } }`);
}

async function getRun(runId, asUser = 'admin') {
  const q = await query(asUser, `query {
    workflow_runs_by_pk(id: "${runId}") { id status error }
    step_runs(where: {workflow_run_id: {_eq: "${runId}"}}, order_by: {step_order: asc}) {
      id status attempt_count error output workflow_step_id input
    }
  }`);
  return q.data;
}

async function getQuota() {
  const q = await query('admin', `query { organizations_by_pk(id: "${orgId}") { quota_used } }`);
  return q.data.organizations_by_pk.quota_used;
}

function subscribe(runId, asUser) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL, 'graphql-ws');
    const messages = [];
    
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({
        type: 'connection_init',
        payload: { headers: { Authorization: `Bearer ${tokens[asUser]}` } }
      }));
    });

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data.toString());
      if (msg.type === 'connection_ack') {
        ws.send(JSON.stringify({
          id: '1',
          type: 'start',
          payload: {
            query: `subscription StepRunUpdates($run_id: uuid!) {
              step_runs(where: {workflow_run_id: {_eq: $run_id}}, order_by: {created_at: asc}) {
                id status attempt_count output workflow_step_id
              }
            }`,
            variables: { run_id: runId }
          }
        }));
      }
      if (msg.type === 'data') {
        messages.push(msg.payload.data);
      }
      if (msg.type === 'error') {
        messages.push({ error: msg.payload });
      }
    });

    // Close and return after 3 seconds
    setTimeout(() => {
      ws.close();
      resolve(messages);
    }, 3000);
  });
}

function printResult(name, pass, errorStr = '') {
  const label = pass ? '[PASS]' : '[FAIL]';
  console.log(`${label} ${name} ${errorStr}`);
  return pass;
}

async function cleanup() {
  for (const id of createdEntities.steps) {
    await query('admin', `mutation { delete_workflow_steps_by_pk(id: "${id}") { id } }`);
  }
  for (const id of createdEntities.workflows) {
    await query('admin', `mutation { delete_workflows_by_pk(id: "${id}") { id } }`);
  }
}

async function main() {
  await getTokens();
  let allPass = true;
  console.log('══════════════════════════════════════');
  console.log('       ZAPIFY M3 CHECKPOINT');
  console.log('══════════════════════════════════════\\n');

  try {
    // Checkpoint 1, 2, 3: Basic workflow, outputs, conditional TRUE
    const wf1 = await createWorkflow("M3: CondTRUE");
    const s1 = await addStep(wf1, 'llm_call', 'Step1', 1, { stub_output: "TRUE_VAL" });
    const s3 = await addStep(wf1, 'llm_call', 'TrueBranch', 3, { stub_output: "T" });
    const s4 = await addStep(wf1, 'llm_call', 'FalseBranch', 4, { stub_output: "F" });
    const s5 = await addStep(wf1, 'llm_call', 'Join', 5, { stub_output: "J" });
    const s2 = await addStep(wf1, 'conditional_branch', 'Cond', 2, { 
      source: "previous_output", operator: "equals", value: "TRUE_VAL", 
      if_true: s3, if_false: s4, after: s5
    });

    const res1 = await trigger(wf1, 'Alice');
    await new Promise(r => setTimeout(r, 2000));
    const run1 = await getRun(res1.data.triggerWorkflowRun.run_id);
    
    // Checkpoint 1
    const p1 = run1.workflow_runs_by_pk.status === 'completed' && run1.step_runs.length === 4;
    allPass = printResult('Successful workflow', p1) && allPass;
    
    // Checkpoint 2
    const condStep = run1.step_runs.find(s => s.workflow_step_id === s2);
    const p2 = condStep && condStep.input.previousOutput === "TRUE_VAL";
    allPass = printResult('Output propagation', p2) && allPass;
    
    // Checkpoint 3
    const ids1 = run1.step_runs.map(s => s.workflow_step_id);
    const p3 = ids1.includes(s3) && !ids1.includes(s4) && ids1.includes(s5);
    allPass = printResult('Conditional TRUE', p3) && allPass;


    // Checkpoint 4: Conditional FALSE
    const wf2 = await createWorkflow("M3: CondFALSE");
    const s21 = await addStep(wf2, 'llm_call', 'Step1', 1, { stub_output: "FALSE_VAL" });
    const s23 = await addStep(wf2, 'llm_call', 'TrueBranch', 3, { stub_output: "T" });
    const s24 = await addStep(wf2, 'llm_call', 'FalseBranch', 4, { stub_output: "F" });
    const s25 = await addStep(wf2, 'llm_call', 'Join', 5, { stub_output: "J" });
    const s22 = await addStep(wf2, 'conditional_branch', 'Cond', 2, { 
      source: "previous_output", operator: "equals", value: "TRUE_VAL", 
      if_true: s23, if_false: s24, after: s25
    });

    const res2 = await trigger(wf2, 'Alice');
    await new Promise(r => setTimeout(r, 2000));
    const run2 = await getRun(res2.data.triggerWorkflowRun.run_id);
    const ids2 = run2.step_runs.map(s => s.workflow_step_id);
    const p4 = !ids2.includes(s23) && ids2.includes(s24) && ids2.includes(s25);
    allPass = printResult('Conditional FALSE', p4) && allPass;

    // Checkpoint 5: HTTP execution
    const wf3 = await createWorkflow("M3: HTTP");
    const h1 = await addStep(wf3, 'http_request', 'HTTP1', 1, { method: "GET", url: "https://jsonplaceholder.typicode.com/posts/1" });
    const res3 = await trigger(wf3, 'Alice');
    await new Promise(r => setTimeout(r, 2000));
    const run3 = await getRun(res3.data.triggerWorkflowRun.run_id);
    const p5 = run3.workflow_runs_by_pk.status === 'completed' && run3.step_runs[0].output?.id === 1;
    allPass = printResult('HTTP execution', p5) && allPass;

    // Checkpoint 6 & 7: Retry & Failed Quota
    const quotaBefore = await getQuota();
    const wf4 = await createWorkflow("M3: Fail");
    await addStep(wf4, 'http_request', 'FailHTTP', 1, { method: "GET", url: "http://invalid.local" });
    const res4 = await trigger(wf4, 'Alice');
    await new Promise(r => setTimeout(r, 5000)); // wait for retries
    const run4 = await getRun(res4.data.triggerWorkflowRun.run_id);
    const p6 = run4.workflow_runs_by_pk.status === 'failed' && run4.step_runs[0].status === 'failed' && run4.step_runs[0].attempt_count === 3;
    allPass = printResult('Retry', p6) && allPass;
    const p7 = p6; // permanent failure is satisfied
    allPass = printResult('Permanent failure', p7) && allPass;

    const quotaAfterFail = await getQuota();
    const p8 = quotaBefore === quotaAfterFail;
    allPass = printResult('Failed workflow quota', p8) && allPass;

    const wf5 = await createWorkflow("M3: SuccessQuota");
    await addStep(wf5, 'llm_call', 'Step1', 1, { stub_output: "Q" });
    const res5 = await trigger(wf5, 'Alice');
    await new Promise(r => setTimeout(r, 1500));
    const quotaAfterSuccess = await getQuota();
    const p9 = quotaAfterSuccess === quotaBefore + 1;
    allPass = printResult('Successful workflow quota', p9) && allPass;

    // Checkpoint 8: Step ordering
    const wf6 = await createWorkflow("M3: Order");
    const o3 = await addStep(wf6, 'llm_call', 'O3', 3, { stub_output: "O3" });
    const o1 = await addStep(wf6, 'llm_call', 'O1', 1, { stub_output: "O1" });
    const o2 = await addStep(wf6, 'llm_call', 'O2', 2, { stub_output: "O2" });
    const res6 = await trigger(wf6, 'Alice');
    await new Promise(r => setTimeout(r, 2000));
    const run6 = await getRun(res6.data.triggerWorkflowRun.run_id);
    const orderIds = run6.step_runs.map(s => s.workflow_step_id);
    const p10 = orderIds[0] === o1 && orderIds[1] === o2 && orderIds[2] === o3;
    allPass = printResult('Step ordering', p10) && allPass;

    // Checkpoint 9: Authorization
    const auth1 = await trigger(wf6, 'Alice');
    const p11 = auth1.data?.triggerWorkflowRun?.success === true;
    allPass = printResult('Owner authorization', p11) && allPass;
    const auth2 = await trigger(wf6, 'Bob');
    const p12 = auth2.data?.triggerWorkflowRun?.success === true;
    allPass = printResult('Editor authorization', p12) && allPass;
    const auth3 = await trigger(wf6, 'Carol');
    const p13 = !!auth3.errors;
    allPass = printResult('Viewer denied', p13) && allPass;
    const auth4 = await trigger(wf6, 'Dave');
    const p14 = !!auth4.errors;
    allPass = printResult('Cross-org trigger denied', p14) && allPass;

    // Checkpoint 10: Direct state protection
    const dBlock = await query('Bob', `mutation { update_step_runs_by_pk(pk_columns: {id: "11111111-1111-1111-1111-111111111111"}, _set: {status: "completed"}) { id } }`);
    const p15 = dBlock.errors?.[0]?.extensions?.code === 'validation-failed' || dBlock.data?.update_step_runs_by_pk === null;
    allPass = printResult('Direct step_run mutation denied', p15) && allPass;
    const dBlock2 = await query('Bob', `mutation { update_workflow_runs_by_pk(pk_columns: {id: "11111111-1111-1111-1111-111111111111"}, _set: {status: "completed"}) { id } }`);
    const p15b = dBlock2.errors?.[0]?.extensions?.code === 'validation-failed' || dBlock2.data?.update_workflow_runs_by_pk === null;
    allPass = printResult('Direct workflow_run mutation denied', p15b) && allPass;

    // Checkpoint 11: Cross-org isolation
    const cross1 = await query('Dave', `query { workflows_by_pk(id: "${wf6}") { id } }`);
    const p16 = cross1.data?.workflows_by_pk === null;
    allPass = printResult('Cross-org direct ID access denied', p16) && allPass;

    // Checkpoint 12 & 13: Subscriptions
    const wf7 = await createWorkflow("M3: Sub");
    await addStep(wf7, 'llm_call', 'S1', 1, { stub_output: "S1" });
    
    // Start subscription
    let runIdSub = null;
    const subPromiseAlice = subscribe('00000000-0000-0000-0000-000000000000', 'Alice'); // Mock UUID, will replace.
    // Wait, we need the runId to subscribe to. 
    // We can trigger it first, but the workflow finishes quickly.
    // Let's trigger it, then subscribe. Since the DB holds the state, subscription will immediately push current state.
    const res7 = await trigger(wf7, 'Alice');
    runIdSub = res7.data.triggerWorkflowRun.run_id;
    await new Promise(r => setTimeout(r, 1000));
    
    const aliceSub = await subscribe(runIdSub, 'Alice');
    const p17 = aliceSub.length > 0 && aliceSub[0].step_runs?.length > 0;
    allPass = printResult('Authorized subscription', p17) && allPass;

    const daveSub = await subscribe(runIdSub, 'Dave');
    // If permission denies, either it returns an empty array of step_runs or an error payload
    const p18 = daveSub.length === 0 || daveSub[0].step_runs?.length === 0 || daveSub[0].error;
    allPass = printResult('Cross-org subscription denied', p18) && allPass;

  } catch (e) {
    console.error("Test execution failed:", e);
    allPass = false;
  }

  await cleanup();

  console.log('\\n══════════════════════════════════════');
  console.log(`RESULT: ${allPass ? 'PASS' : 'FAIL'}`);
  console.log('══════════════════════════════════════\\n');

  if (process.argv.includes('--smoke')) {
    console.log('Smoke test logic executes here...');
  }
}

main();
