import crypto from 'crypto';
import { WebSocket } from 'ws';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const GRAPHQL_URL = 'https://local.hasura.local.nhost.run/v1/graphql';
const WS_URL = 'wss://local.hasura.local.nhost.run/v1/graphql';
const AUTH_URL = 'https://local.auth.local.nhost.run/v1/signin/email-password';
const ADMIN_SECRET = 'nhost-admin-secret';

const users = [
  { name: 'Alice', email: 'alice@test.com', password: 'password123' },
  { name: 'Bob', email: 'bob@test.com', password: 'password123' },
  { name: 'Carol', email: 'carol@test.com', password: 'password123' },
  { name: 'Dave', email: 'dave@test.com', password: 'password123' },
];

let tokens = {};
let ids = {};
let orgA;
let orgB;
let allPass = true;

function printResult(name, pass) {
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}`);
  return pass;
}

async function getTokens() {
  for (const u of users) {
    const res = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.email, password: u.password })
    });
    let data;
    try {
      data = await res.json();
    } catch (e) {
      console.log(`Auth failed parsing JSON for ${u.name}. Status: ${res.status}`);
    }
    if (data?.session) {
      tokens[u.name] = data.session.accessToken;
      ids[u.name] = data.session.user.id;
    } else {
      console.error(`Login failed for ${u.name}`);
    }
  }
}

async function graphql(query, variables = {}, asUser = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (asUser === 'ADMIN') {
    headers['x-hasura-admin-secret'] = ADMIN_SECRET;
  } else if (asUser) {
    headers['Authorization'] = `Bearer ${tokens[asUser]}`;
  }

  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables })
  });
  return await res.json();
}

async function setup() {
  await getTokens();
  
  const qA = `query { organizations(where: { name: {_eq: "Org A"}}) { id quota_used } }`;
  const resA = await graphql(qA, {}, 'ADMIN');
  orgA = resA.data.organizations[0].id;
  let initialQuotaA = resA.data.organizations[0].quota_used;
  
  const qB = `query { organizations(where: { name: {_eq: "Org B"}}) { id } }`;
  const resB = await graphql(qB, {}, 'ADMIN');
  orgB = resB.data.organizations[0].id;

  const insertMembersQ = `
    mutation($org_a: uuid!, $org_b: uuid!, $alice: uuid!, $bob: uuid!, $carol: uuid!, $dave: uuid!) {
      delete_org_members(where: {_or: [{org_id: {_eq: $org_a}}, {org_id: {_eq: $org_b}}]}) { affected_rows }
      insert_org_members(objects: [
        {org_id: $org_a, user_id: $alice, role: "owner"},
        {org_id: $org_a, user_id: $bob, role: "editor"},
        {org_id: $org_a, user_id: $carol, role: "viewer"},
        {org_id: $org_b, user_id: $dave, role: "owner"}
      ]) { affected_rows }
    }
  `;
  await graphql(insertMembersQ, {
    org_a: orgA,
    org_b: orgB,
    alice: ids['Alice'],
    bob: ids['Bob'],
    carol: ids['Carol'],
    dave: ids['Dave']
  }, 'ADMIN');
  
  return initialQuotaA;
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

function startSubscription(workflowRunId, asUser, logArr) {
  const ws = new WebSocket(WS_URL, 'graphql-ws', { rejectUnauthorized: false });
  ws.on('open', () => {
    ws.send(JSON.stringify({
      type: 'connection_init',
      payload: { headers: { Authorization: `Bearer ${tokens[asUser]}` } }
    }));
  });
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'connection_ack') {
      ws.send(JSON.stringify({
        id: '1',
        type: 'start',
        payload: {
          query: `subscription { 
            workflow_runs_by_pk(id: "${workflowRunId}") { 
              status 
              step_runs(order_by: {step_order: asc}) { 
                id status workflow_step_id
              }
            }
          }`
        }
      }));
    } else if (msg.type === 'data') {
      logArr.push(msg.payload.data.workflow_runs_by_pk);
    }
  });
  return ws;
}

async function getRun(runId, asUser) {
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
        approved_by
        approved_at
      }
    }
  }`;
  return await graphql(q, {}, asUser);
}

async function manualTrigger(workflowId, asUser) {
  const q = `mutation { triggerWorkflowRun(workflow_id: "${workflowId}") { success run_id status } }`;
  return await graphql(q, {}, asUser);
}

async function webhookTrigger(workflowId, payload, secretHeader) {
  const q = `
    mutation WebhookTrigger($workflow_id: uuid!, $payload: jsonb) {
      triggerWorkflowWebhook(workflow_id: $workflow_id, payload: $payload) {
        success
        run_id
        status
      }
    }
  `;
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-zapify-webhook-secret': secretHeader
    },
    body: JSON.stringify({ query: q, variables: { workflow_id: workflowId, payload } })
  });
  return await res.json();
}

async function approveStep(stepRunId, asUser) {
  const q = `mutation { approveStep(step_run_id: "${stepRunId}") { success run_id status } }`;
  return await graphql(q, {}, asUser);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("══════════════════════════════════════════");
  console.log("        ZAPIFY FINAL E2E VERIFICATION     ");
  console.log("══════════════════════════════════════════\\n");

  const initialQuota = await setup();
  allPass = printResult('Org A / Org B setup', !!orgA && !!orgB) && allPass;
  allPass = printResult('Role assignments', !!ids['Alice'] && !!ids['Dave']) && allPass;

  const wf = await createWorkflow("M3.6 Final E2E");
  
  // 1. HTTP Request
  const stepHttp = await addStep(wf, 'http_request', 'Step1_HTTP', 1, { url: "https://jsonplaceholder.typicode.com/todos/1" });
  
  // 2. LLM (deterministic)
  const stepLlm = await addStep(wf, 'llm_call', 'Step2_LLM', 2, { prompt: "Return exactly YES", stub_output: "YES" });
  
  // 4. Approval Gate (Step 4)
  const stepApproval = await addStep(wf, 'approval_gate', 'Step4_Approval', 4, {});
  
  // 5. Post-Approval Step
  const stepPostApp = await addStep(wf, 'http_request', 'Step5_Post', 5, { url: "https://jsonplaceholder.typicode.com/todos/2" });
  
  // Unselected branch (Step 6)
  const stepFalseBranch = await addStep(wf, 'http_request', 'Step6_False', 6, { url: "https://example.com" });
  
  // 3. Conditional
  const stepCond = await addStep(wf, 'conditional_branch', 'Step3_Conditional', 3, {
    source: "previous_output",
    operator: "equals",
    value: "YES",
    if_true: stepApproval,
    if_false: stepFalseBranch
  });

  const webhookSecret = "super-secret-e2e";
  const webhookHash = crypto.createHash('sha256').update(webhookSecret).digest('hex');
  await addWebhookTrigger(wf, webhookHash, 'Alice');

  // 4. Verify Workflow Configuration via Alice
  const confQuery = await graphql(`query { workflows_by_pk(id: "${wf}") { org_id workflow_steps { step_type name } } }`, {}, 'Alice');
  const wfDef = confQuery.data?.workflows_by_pk;
  let confPass = wfDef && wfDef.org_id === orgA && wfDef.workflow_steps.length === 6;
  allPass = printResult('Workflow configuration', confPass) && allPass;

  // 5. Manual Execution Path
  const manRes = await manualTrigger(wf, 'Alice');
  const manRunId = manRes.data?.triggerWorkflowRun?.run_id;
  if (!manRunId) console.error("Debug manRes:", JSON.stringify(manRes, null, 2));
  allPass = printResult('Manual trigger', !!manRunId && manRes.data?.triggerWorkflowRun?.status === 'running') && allPass;

  const subLog = [];
  const ws = startSubscription(manRunId, 'Alice', subLog);
  
  // Wait for pause
  await sleep(4000);
  
  const runRes = await getRun(manRunId, 'Alice');
  if (!runRes.data) {
    console.error("Debug manRun missing data:", runRes);
  }
  const manRun = runRes.data.workflow_runs_by_pk;
  
  const llmRun = manRun.step_runs.find(s => s.workflow_step_id === stepLlm);
  const httpRun = manRun.step_runs.find(s => s.workflow_step_id === stepHttp);
  const condRun = manRun.step_runs.find(s => s.workflow_step_id === stepCond);
  const falseRun = manRun.step_runs.find(s => s.workflow_step_id === stepFalseBranch);
  const appRun = manRun.step_runs.find(s => s.workflow_step_id === stepApproval);
  const postAppRun = manRun.step_runs.find(s => s.workflow_step_id === stepPostApp);
  
  if (!appRun) console.error("Debug: condRun output:", condRun, "All step_runs:", manRun.step_runs);
  
  allPass = printResult('Manual LLM execution', llmRun && llmRun.status === 'completed') && allPass;
  allPass = printResult('Manual HTTP execution', httpRun && httpRun.status === 'completed') && allPass;
  allPass = printResult('Manual conditional branch', condRun && condRun.status === 'completed' && !falseRun) && allPass;
  allPass = printResult('Manual approval pause', manRun.status === 'paused' && appRun && appRun.status === 'waiting_for_approval' && !postAppRun) && allPass;
  
  // 9. Authorization checks for approval
  const reject1 = await approveStep(appRun.id, 'Carol'); // Viewer
  allPass = printResult('Viewer approval denied', reject1.errors && reject1.errors.length > 0) && allPass;

  const reject2 = await approveStep(appRun.id, 'Dave'); // Cross-org
  allPass = printResult('Cross-org approval denied', reject2.errors && reject2.errors.length > 0) && allPass;

  const approveRes = await approveStep(appRun.id, 'Bob'); // Editor
  allPass = printResult('Editor approval succeeded', !approveRes.errors && approveRes.data.approveStep.success) && allPass;

  await sleep(4000);
  ws.close();

  // Verify Live Pause/Resume Subscription
  const wasPaused = subLog.some(log => log.status === 'paused');
  const becameCompleted = subLog.some(log => log.status === 'completed');
  allPass = printResult('Live pause/resume subscription', wasPaused && becameCompleted) && allPass;

  const manRunFinal = (await getRun(manRunId, 'Alice')).data.workflow_runs_by_pk;
  allPass = printResult('Manual run completed', manRunFinal.status === 'completed' && manRunFinal.trigger_type === 'manual') && allPass;
  
  const finalQuota = await graphql(`query { organizations_by_pk(id: "${orgA}") { quota_used } }`, {}, 'ADMIN');
  allPass = printResult('Manual quota incremented exactly once', finalQuota.data.organizations_by_pk.quota_used === initialQuota + 1) && allPass;

  // 13. Webhook Execution Path
  const hookRes = await webhookTrigger(wf, { test: "payload" }, webhookSecret);
  const hookRunId = hookRes.data?.triggerWorkflowWebhook?.run_id;
  allPass = printResult('Webhook trigger', !!hookRunId) && allPass;

  await sleep(4000);
  const hookRun = (await getRun(hookRunId, 'Alice')).data.workflow_runs_by_pk;
  
  const hookHttpRun = hookRun.step_runs.find(s => s.workflow_step_id === stepHttp);
  const hookAppRun = hookRun.step_runs.find(s => s.workflow_step_id === stepApproval);
  
  // Verify payload propagation in step 1 input context
  let payloadPassed = false;
  if (hookHttpRun && hookHttpRun.input) {
    payloadPassed = hookHttpRun.input.previousOutput?.test === "payload";
  }
  allPass = printResult('Webhook payload propagation', payloadPassed) && allPass;
  allPass = printResult('Webhook approval pause', hookRun.status === 'paused' && hookAppRun && hookAppRun.status === 'waiting_for_approval') && allPass;
  
  const hookApproveRes = await approveStep(hookAppRun.id, 'Bob');
  allPass = printResult('Webhook editor approval', !hookApproveRes.errors) && allPass;
  
  await sleep(4000);
  const hookRunFinal = (await getRun(hookRunId, 'Alice')).data.workflow_runs_by_pk;
  allPass = printResult('Webhook run completed', hookRunFinal.status === 'completed' && hookRunFinal.trigger_type === 'webhook') && allPass;

  // 15. Cross-org attack
  const qRead1 = await graphql(`query { workflows_by_pk(id: "${wf}") { id } }`, {}, 'Dave');
  allPass = printResult('Cross-org workflow query blocked', !qRead1.data.workflows_by_pk) && allPass;
  
  const qRead2 = await graphql(`query { workflow_runs_by_pk(id: "${manRunId}") { id } }`, {}, 'Dave');
  allPass = printResult('Cross-org direct ID access blocked', !qRead2.data.workflow_runs_by_pk) && allPass;

  const manTrigDave = await manualTrigger(wf, 'Dave');
  allPass = printResult('Cross-org manual trigger blocked', manTrigDave.errors && manTrigDave.errors.length > 0) && allPass;
  
  const appTrigDave = await approveStep(appRun.id, 'Dave');
  allPass = printResult('Cross-org approval blocked', appTrigDave.errors && appTrigDave.errors.length > 0) && allPass;
  
  let subDaveReceivedData = false;
  const wsDave = new WebSocket(WS_URL, 'graphql-ws', { rejectUnauthorized: false });
  wsDave.on('open', () => {
    wsDave.send(JSON.stringify({ type: 'connection_init', payload: { headers: { Authorization: `Bearer ${tokens['Dave']}` } } }));
  });
  wsDave.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'connection_ack') {
      wsDave.send(JSON.stringify({
        id: '1', type: 'start', payload: { query: `subscription { workflow_runs_by_pk(id: "${manRunId}") { status } }` }
      }));
    } else if (msg.type === 'data') {
      if (msg.payload.data && msg.payload.data.workflow_runs_by_pk) {
        subDaveReceivedData = true;
      }
    }
  });
  await sleep(1500);
  wsDave.close();
  allPass = printResult('Cross-org subscription blocked', !subDaveReceivedData) && allPass;

  // 17. Direct execution-state mutation blocked
  const qMut = await graphql(`mutation { delete_workflow_runs(where: {id: {_eq: "${manRunId}"}}) { affected_rows } }`, {}, 'Bob');
  allPass = printResult('Direct execution-state mutation blocked', qMut.errors && qMut.errors.length > 0) && allPass;
  
  // Exactly once behavior check
  const llms = manRunFinal.step_runs.filter(s => s.workflow_step_id === stepLlm);
  const htts = manRunFinal.step_runs.filter(s => s.workflow_step_id === stepHttp);
  const apps = manRunFinal.step_runs.filter(s => s.workflow_step_id === stepApproval);
  const posts = manRunFinal.step_runs.filter(s => s.workflow_step_id === stepPostApp);
  allPass = printResult('Exactly once behavior verified', llms.length === 1 && htts.length === 1 && apps.length === 1 && posts.length === 1) && allPass;

  console.log("\\n══════════════════════════════════════════");
  console.log(`              RESULT: ${allPass ? 'PASS' : 'FAIL'}`);
  console.log("══════════════════════════════════════════");
  
  if (!allPass) process.exit(1);
}

main().catch(e => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
