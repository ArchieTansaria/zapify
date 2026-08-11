import { WebSocket } from 'ws';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const tokens = {};
const ids = {};

async function getTokens() {
  const users = [
    { email: 'alice@test.com', password: 'password123', name: 'Alice' },
    { email: 'bob@test.com', password: 'password123', name: 'Bob' },
    { email: 'carol@test.com', password: 'password123', name: 'Carol' },
    { email: 'dave@test.com', password: 'password123', name: 'Dave' },
    { email: 'eve@test.com', password: 'password123', name: 'Eve' }
  ];
  for (const u of users) {
    // Signup if not exist, otherwise sign in
    let res = await fetch('https://local.auth.local.nhost.run/v1/signup/email-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.email, password: u.password })
    });
    let data;
    try {
      data = await res.json();
    } catch(e) {}
    
    if (res.status !== 200) {
      res = await fetch('https://local.auth.local.nhost.run/v1/signin/email-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: u.email, password: u.password })
      });
      data = await res.json();
    }
    if (data?.session) {
      tokens[u.name] = data.session.accessToken;
      ids[u.name] = data.session.user.id;
    }
  }
}

async function query(asUser, q, variables = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (asUser === 'admin') {
    headers['x-hasura-admin-secret'] = 'nhost-admin-secret';
  } else if (asUser) {
    headers['Authorization'] = `Bearer ${tokens[asUser]}`;
  }
  
  const res = await fetch('https://local.hasura.local.nhost.run/v1/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: q, variables })
  });
  return res.json();
}

function expectSuccessRun(res) {
  const data = res.data?.triggerWorkflowRun;
  if (!data) return `FAIL: ${JSON.stringify(res)}`;
  if (data.success && data.run_id && data.status === 'running') {
    return `PASS (run_id: ${data.run_id})`;
  }
  return `FAIL: ${JSON.stringify(data)}`;
}

function expectDenied(res) {
  if (res.errors) {
    return `PASS (Error: ${res.errors[0].message})`;
  }
  const data = res.data?.triggerWorkflowRun;
  if (data) {
    return `FAIL: Unexpected success: ${JSON.stringify(data)}`;
  }
  return `FAIL: Unknown response: ${JSON.stringify(res)}`;
}

async function verifyExecutionState(runId, asUser) {
  // Try to query the run directly
  const q = await query(asUser, `query { workflow_runs_by_pk(id: "${runId}") { id status triggered_by trigger_type } }`);
  if (!q.data?.workflow_runs_by_pk) {
    return `FAIL: could not SELECT run (Got ${JSON.stringify(q)})`;
  }
  const run = q.data.workflow_runs_by_pk;
  return `PASS (run selected: status=${run.status}, triggered_by=${run.triggered_by}, trigger_type=${run.trigger_type})`;
}

async function verifyMutationsBlocked(asUser, runId) {
  // Test UPDATE
  let q1 = await query(asUser, `mutation { update_workflow_runs_by_pk(pk_columns: {id: "${runId}"}, _set: {status: "completed"}) { id } }`);
  let uBlocked = q1.errors && q1.errors[0].extensions?.code === 'validation-failed' ? true : false;
  if (!uBlocked) uBlocked = q1.data?.update_workflow_runs_by_pk === null; // In case it's filtered
  // If the mutation field itself is hidden, it's validation-failed.

  // Test INSERT
  let q2 = await query(asUser, `mutation { insert_workflow_runs_one(object: {workflow_id: "11111111-1111-1111-1111-111111111111", status: "running"}) { id } }`);
  let iBlocked = q2.errors && q2.errors[0].extensions?.code === 'validation-failed' ? true : false;

  // Test DELETE
  let q3 = await query(asUser, `mutation { delete_workflow_runs_by_pk(id: "${runId}") { id } }`);
  let dBlocked = q3.errors && q3.errors[0].extensions?.code === 'validation-failed' ? true : false;
  if (!dBlocked) dBlocked = q3.data?.delete_workflow_runs_by_pk === null;

  if (uBlocked && iBlocked && dBlocked) {
    return 'PASS (Insert/Update/Delete blocked)';
  }
  return `FAIL: U=${uBlocked}, I=${iBlocked}, D=${dBlocked}`;
}

async function main() {
  await getTokens();
  
  const workflowA = "11111111-1111-1111-1111-111111111111"; // Org A workflow
  const fakeWorkflow = "99999999-9999-9999-9999-999999999999";
  
  console.log('--- TriggerWorkflowRun Tests ---');
  
  // 1. Owner Alice
  let resAlice = await query('Alice', `mutation { triggerWorkflowRun(workflow_id: "${workflowA}") { success run_id status } }`);
  console.log('1. Alice (Owner):', expectSuccessRun(resAlice));
  let aliceRunId = resAlice.data?.triggerWorkflowRun?.run_id;
  
  if (aliceRunId) {
    console.log('   -> Verifying DB state (Alice SELECT):', await verifyExecutionState(aliceRunId, 'Alice'));
  }

  // 2. Editor Bob
  let resBob = await query('Bob', `mutation { triggerWorkflowRun(workflow_id: "${workflowA}") { success run_id status } }`);
  console.log('2. Bob (Editor):', expectSuccessRun(resBob));
  let bobRunId = resBob.data?.triggerWorkflowRun?.run_id;

  if (bobRunId) {
    console.log('   -> Verifying DB state (Bob SELECT):', await verifyExecutionState(bobRunId, 'Bob'));
    console.log('   -> Verifying mutations blocked for Bob:', await verifyMutationsBlocked('Bob', bobRunId));
  }

  // 3. Viewer Carol
  let resCarol = await query('Carol', `mutation { triggerWorkflowRun(workflow_id: "${workflowA}") { success run_id status } }`);
  console.log('3. Carol (Viewer):', expectDenied(resCarol));

  // 4. Cross-org attack Dave (Org B)
  let resDave = await query('Dave', `mutation { triggerWorkflowRun(workflow_id: "${workflowA}") { success run_id status } }`);
  console.log('4. Dave (Org B Owner):', expectDenied(resDave));

  // 5. No membership Eve
  let resEve = await query('Eve', `mutation { triggerWorkflowRun(workflow_id: "${workflowA}") { success run_id status } }`);
  console.log('5. Eve (No membership):', expectDenied(resEve));

  // 6. Invalid workflow UUID
  let resInvalid = await query('Alice', `mutation { triggerWorkflowRun(workflow_id: "${fakeWorkflow}") { success run_id status } }`);
  console.log('6. Invalid Workflow:', expectDenied(resInvalid));

  // 7. Quota exhausted
  // Get org id first via admin
  let qOrg = await query('admin', `query { workflows_by_pk(id: "${workflowA}") { org_id } }`);
  let orgId = qOrg.data.workflows_by_pk.org_id;
  
  console.log('\\n--- Quota Tests ---');
  // Update quota to exhausted
  await query('admin', `mutation { update_organizations_by_pk(pk_columns: {id: "${orgId}"}, _set: {quota_used: 1000, quota_limit: 1000}) { id } }`);
  
  let resQuota = await query('Bob', `mutation { triggerWorkflowRun(workflow_id: "${workflowA}") { success run_id status } }`);
  console.log('7. Quota exhausted (Bob):', expectDenied(resQuota));
  
  // Cleanup quota
  await query('admin', `mutation { update_organizations_by_pk(pk_columns: {id: "${orgId}"}, _set: {quota_used: 0}) { id } }`);
  console.log('   -> Quota restored to 0');

  process.exit(0);
}

main();
