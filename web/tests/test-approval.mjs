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
  const users = [
    { email: 'alice@test.com', password: 'password123', name: 'Alice' },
    { email: 'bob@test.com', password: 'password123', name: 'Bob' },
    { email: 'carol@test.com', password: 'password123', name: 'Carol' },
    { email: 'dave@test.com', password: 'password123', name: 'Dave' },
  ];
  for (const u of users) {
    let res = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.email, password: u.password })
    });
    try {
      let data = await res.json();
      if (data?.session) {
        tokens[u.name] = data.session.accessToken;
        ids[u.name] = data.session.user.id;
      }
    } catch (e) {
      console.error("Auth fetch failed for", u.email, ":", res.status, res.statusText);
      throw e;
    }
  }
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
  return await res.json();
}

async function createWorkflow(name) {
  const q = await query('admin', `mutation { insert_workflows_one(object: {org_id: "${orgId}", name: "${name}"}) { id } }`);
  const id = q.data.insert_workflows_one.id;
  createdEntities.workflows.push(id);
  return id;
}

async function addStep(workflowId, type, name, order, config) {
  const q = await query('admin', `mutation($config: jsonb!) { insert_workflow_steps_one(object: { workflow_id: "${workflowId}", step_type: "${type}", name: "${name}", step_order: ${order}, config: $config }) { id } }`, { config });
  const id = q.data.insert_workflow_steps_one.id;
  createdEntities.steps.push(id);
  return id;
}

async function trigger(workflowId, asUser = 'Alice') {
  return await query(asUser, `mutation { triggerWorkflowRun(workflow_id: "${workflowId}") { success run_id status } }`);
}

async function approve(stepRunId, asUser = 'Alice') {
  return await query(asUser, `mutation { approveStep(step_run_id: "${stepRunId}") { success run_id status } }`);
}

async function getRun(runId, asUser = 'admin') {
  const q = await query(asUser, `query { workflow_runs_by_pk(id: "${runId}") { id status error } step_runs(where: {workflow_run_id: {_eq: "${runId}"}}, order_by: {step_order: asc}) { id status attempt_count error output workflow_step_id input approved_by approved_at } }`);
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
    ws.addEventListener('open', () => { ws.send(JSON.stringify({ type: 'connection_init', payload: { headers: { Authorization: `Bearer ${tokens[asUser]}` } } })); });
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data.toString());
      if (msg.type === 'connection_ack') {
        ws.send(JSON.stringify({ id: '1', type: 'start', payload: { query: `subscription { workflow_runs_by_pk(id: "${runId}") { status step_runs(order_by: {created_at: asc}) { id status } } }` } }));
      }
      if (msg.type === 'data') messages.push(msg.payload.data);
      if (msg.type === 'error') messages.push({ error: msg.payload });
    });
    setTimeout(() => { ws.close(); resolve(messages); }, 4000);
  });
}

function printResult(name, pass, errorStr = '') {
  console.log(`${pass ? '[PASS]' : '[FAIL]'} ${name} ${errorStr}`);
  return pass;
}

async function cleanup() {
  for (const id of createdEntities.steps) { await query('admin', `mutation { delete_workflow_steps_by_pk(id: "${id}") { id } }`); }
  for (const id of createdEntities.workflows) { await query('admin', `mutation { delete_workflows_by_pk(id: "${id}") { id } }`); }
}

async function main() {
  await getTokens();
  let allPass = true;
  console.log('══════════════════════════════════════');
  console.log('       ZAPIFY M3.4 APPROVAL TESTS');
  console.log('══════════════════════════════════════\\n');

  try {
    const wf1 = await createWorkflow("M3.4: Basic Approval");
    const s1 = await addStep(wf1, 'llm_call', 'Step1', 1, { stub_output: "1" });
    const s2 = await addStep(wf1, 'approval_gate', 'Gate', 2, {});
    const s3 = await addStep(wf1, 'http_request', 'Step3', 3, { method: "GET", url: "https://jsonplaceholder.typicode.com/posts/1" });

    // Test 1: Trigger and Pause
    const res1 = await trigger(wf1, 'Alice');
    const runId1 = res1.data?.triggerWorkflowRun?.run_id;
    await new Promise(r => setTimeout(r, 1500));
    let run1 = await getRun(runId1);
    const gateStepRun = run1.step_runs.find(s => s.workflow_step_id === s2);
    
    let p1 = run1.workflow_runs_by_pk.status === 'paused' && gateStepRun && gateStepRun.status === 'waiting_for_approval';
    let p2 = run1.step_runs.length === 2 && !run1.step_runs.some(s => s.workflow_step_id === s3);
    allPass = printResult('Test 1: approval gate pauses workflow & step', p1) && allPass;
    allPass = printResult('Test 2: original execution stops at gate', p2) && allPass;

    // Test 3: Owner Approval
    const approveRes = await approve(gateStepRun.id, 'Alice');
    await new Promise(r => setTimeout(r, 2000));
    run1 = await getRun(runId1);
    const updatedGate = run1.step_runs.find(s => s.workflow_step_id === s2);
    let p3 = updatedGate.approved_by === ids['Alice'] && updatedGate.approved_at !== null && run1.workflow_runs_by_pk.status === 'completed';
    allPass = printResult('Test 3: owner approval succeeds & finishes workflow', p3) && allPass;
    let p11 = run1.step_runs.length === 3 && run1.step_runs.find(s => s.workflow_step_id === s3)?.status === 'completed' && run1.step_runs.filter(s => s.workflow_step_id === s1).length === 1;
    allPass = printResult('Test 11: resume does not restart earlier steps', p11) && allPass;

    // Test 4: Editor Approval
    const res4 = await trigger(wf1, 'Alice');
    const runId4 = res4.data.triggerWorkflowRun.run_id;
    await new Promise(r => setTimeout(r, 1500));
    let run4 = await getRun(runId4);
    const gate4 = run4.step_runs.find(s => s.workflow_step_id === s2);
    const approveRes4 = await approve(gate4.id, 'Bob');
    await new Promise(r => setTimeout(r, 2000));
    run4 = await getRun(runId4);
    let p4 = run4.workflow_runs_by_pk.status === 'completed' && run4.step_runs.find(s => s.workflow_step_id === s2).approved_by === ids['Bob'];
    allPass = printResult('Test 4: editor approval succeeds', p4) && allPass;

    // Test 5 & 6: Viewer & Cross-Org
    const res5 = await trigger(wf1, 'Alice');
    const runId5 = res5.data.triggerWorkflowRun.run_id;
    await new Promise(r => setTimeout(r, 1500));
    let run5 = await getRun(runId5);
    const gate5 = run5.step_runs.find(s => s.workflow_step_id === s2);
    
    const approveRes5 = await approve(gate5.id, 'Carol');
    let p5 = !!approveRes5.errors || approveRes5.data?.approveStep === null;
    let run5check = await getRun(runId5);
    p5 = p5 && run5check.workflow_runs_by_pk.status === 'paused' && run5check.step_runs.find(s => s.workflow_step_id === s2).approved_by === null;
    allPass = printResult('Test 5: viewer cannot approve', p5) && allPass;

    const approveRes6 = await approve(gate5.id, 'Dave');
    let p6 = !!approveRes6.errors || approveRes6.data?.approveStep === null;
    run5check = await getRun(runId5);
    p6 = p6 && run5check.workflow_runs_by_pk.status === 'paused';
    allPass = printResult('Test 6: cross-org approval attack denied', p6) && allPass;

    // Test 7 & 8: Invalid & Non-approval
    const approveRes7 = await approve("11111111-1111-1111-1111-111111111111", 'Alice');
    let p7 = !!approveRes7.errors || approveRes7.data?.approveStep === null;
    allPass = printResult('Test 7: invalid step_run safely fails', p7) && allPass;

    const s1Run = run5check.step_runs.find(s => s.workflow_step_id === s1);
    const approveRes8 = await approve(s1Run.id, 'Alice');
    let p8 = !!approveRes8.errors || approveRes8.data?.approveStep === null;
    allPass = printResult('Test 8: non-approval step denied', p8) && allPass;

    // Test 9 & 10: Already approved & Concurrent
    const approveRes9 = await approve(gate5.id, 'Alice'); // 1st success
    const approveRes9b = await approve(gate5.id, 'Alice'); // 2nd fail
    let p9 = approveRes9.data?.approveStep?.success === true && (!!approveRes9b.errors || approveRes9b.data?.approveStep === null);
    allPass = printResult('Test 9: already approved gate cannot be approved again', p9) && allPass;

    // Test 12: Quota
    const quotaBefore = await getQuota();
    const wfQuota = await createWorkflow("M3.4: Quota");
    await addStep(wfQuota, 'approval_gate', 'Gate', 1, {});
    const resQuota = await trigger(wfQuota, 'Alice');
    await new Promise(r => setTimeout(r, 1000));
    const quotaMid = await getQuota();
    let p12 = quotaMid === quotaBefore;
    const runQuota = await getRun(resQuota.data.triggerWorkflowRun.run_id);
    await approve(runQuota.step_runs[0].id, 'Alice');
    await new Promise(r => setTimeout(r, 1500));
    const quotaAfter = await getQuota();
    p12 = p12 && quotaAfter === (quotaBefore + 1);
    allPass = printResult('Test 12: quota exactly once (not on pause, yes on complete)', p12) && allPass;

    // Test 13: Failure after approval
    const wfFail = await createWorkflow("M3.4: Fail After");
    await addStep(wfFail, 'approval_gate', 'Gate', 1, {});
    await addStep(wfFail, 'http_request', 'Fail', 2, { method: "GET", url: "http://invalid.local" });
    const resFail = await trigger(wfFail, 'Alice');
    await new Promise(r => setTimeout(r, 1000));
    let runFail = await getRun(resFail.data.triggerWorkflowRun.run_id);
    await approve(runFail.step_runs[0].id, 'Alice');
    await new Promise(r => setTimeout(r, 5000)); // wait for retries
    runFail = await getRun(resFail.data.triggerWorkflowRun.run_id);
    let p13 = runFail.workflow_runs_by_pk.status === 'failed' && runFail.step_runs[0].status === 'completed' && runFail.step_runs[1].status === 'failed';
    allPass = printResult('Test 13: failure after approval', p13) && allPass;

    // Test 14 & 15: Subscriptions
    const wfSub = await createWorkflow("M3.4: Sub");
    const sSub1 = await addStep(wfSub, 'approval_gate', 'Gate', 1, {});
    
    const subRes = await trigger(wfSub, 'Alice');
    const runIdSub = subRes.data.triggerWorkflowRun.run_id;
    
    // Start Alice sub immediately
    const aliceSubP = subscribe(runIdSub, 'Alice');
    const daveSubP = subscribe(runIdSub, 'Dave');
    
    await new Promise(r => setTimeout(r, 1000));
    let runSub = await getRun(runIdSub);
    await approve(runSub.step_runs[0].id, 'Alice');
    
    const aliceSub = await aliceSubP;
    const daveSub = await daveSubP;
    
    const hasPaused = aliceSub.some(msg => msg.workflow_runs_by_pk?.status === 'paused' || msg.workflow_runs_by_pk?.step_runs?.some(s => s.status === 'waiting_for_approval'));
    const hasCompleted = aliceSub.some(msg => msg.workflow_runs_by_pk?.status === 'completed');
    let p14 = hasPaused && hasCompleted;
    allPass = printResult('Test 14: realtime pause/resume seen', p14) && allPass;
    
    let p15 = daveSub.length === 0 || daveSub[0].error || !daveSub.some(msg => msg.workflow_runs_by_pk?.step_runs?.length > 0);
    allPass = printResult('Test 15: cross-org realtime protection', p15) && allPass;

  } catch (e) {
    console.error("Test execution failed:", e);
    allPass = false;
  }

  await cleanup();

  console.log('\\n══════════════════════════════════════');
  console.log(`RESULT: ${allPass ? 'PASS' : 'FAIL'}`);
  console.log('══════════════════════════════════════\\n');
}

main();
