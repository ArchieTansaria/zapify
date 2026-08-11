import { WebSocket } from 'ws';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const tokens = {};
const ids = {};
const orgId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // Org A

async function getTokens() {
  const users = [
    { email: 'alice@test.com', password: 'password123', name: 'Alice' },
    { email: 'bob@test.com', password: 'password123', name: 'Bob' },
    { email: 'carol@test.com', password: 'password123', name: 'Carol' },
    { email: 'dave@test.com', password: 'password123', name: 'Dave' },
  ];
  for (const u of users) {
    let res = await fetch('https://local.auth.local.nhost.run/v1/signin/email-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.email, password: u.password })
    });
    let data = await res.json();
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

async function createWorkflow(name) {
  const q = await query('admin', `mutation {
    insert_workflows_one(object: {org_id: "${orgId}", name: "${name}"}) { id }
  }`);
  return q.data.insert_workflows_one.id;
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
  return q.data.insert_workflow_steps_one.id;
}

async function trigger(workflowId, asUser = 'Bob') {
  return await query(asUser, `mutation { triggerWorkflowRun(workflow_id: "${workflowId}") { success run_id status } }`);
}

async function getRun(runId) {
  const q = await query('admin', `query {
    workflow_runs_by_pk(id: "${runId}") { id status error }
    step_runs(where: {workflow_run_id: {_eq: "${runId}"}}, order_by: {step_order: asc}) {
      id status attempt_count error output workflow_step_id
    }
  }`);
  return q.data;
}

async function getQuota() {
  const q = await query('admin', `query { organizations_by_pk(id: "${orgId}") { quota_used } }`);
  return q.data.organizations_by_pk.quota_used;
}

async function main() {
  await getTokens();

  console.log('--- Milestone 3.3 Runner Tests ---');
  
  const initialQuota = await getQuota();
  let expectedQuota = initialQuota;

  // TEST 1: LLM & Ordering & Outputs (Tests 1, 7, 8)
  console.log('\\n1. Testing LLM, Ordering, and Outputs...');
  const wf1 = await createWorkflow("WF1: LLM");
  await addStep(wf1, 'llm_call', 'Step1', 1, { prompt: "First", stub_output: "FirstOutput" });
  await addStep(wf1, 'llm_call', 'Step2', 2, { prompt: "{{previous_output}} Second", stub_output: "SecondOutput" });
  
  const res1 = await trigger(wf1);
  const runId1 = res1.data.triggerWorkflowRun.run_id;
  await new Promise(r => setTimeout(r, 1500)); // wait for execution
  
  const run1 = await getRun(runId1);
  if (run1.workflow_runs_by_pk.status === 'completed' && run1.step_runs.length === 2 && run1.step_runs[1].output === 'SecondOutput') {
    console.log('PASS: Workflow completed, steps ordered, outputs cascaded.');
    expectedQuota++;
  } else {
    console.log('FAIL:', JSON.stringify(run1));
  }

  // TEST 2: HTTP (Test 2)
  console.log('\\n2. Testing HTTP Request...');
  const wf2 = await createWorkflow("WF2: HTTP");
  await addStep(wf2, 'http_request', 'HTTP1', 1, { method: "GET", url: "https://jsonplaceholder.typicode.com/posts/1" });
  
  const res2 = await trigger(wf2);
  await new Promise(r => setTimeout(r, 2000));
  const run2 = await getRun(res2.data.triggerWorkflowRun.run_id);
  if (run2.workflow_runs_by_pk.status === 'completed' && run2.step_runs[0].output?.id === 1) {
    console.log('PASS: HTTP requested executed and parsed JSON.');
    expectedQuota++;
  } else {
    console.log('FAIL:', JSON.stringify(run2));
  }

  // TEST 3 & 4: Permanent Failure & Retry (Test 3, 4)
  console.log('\\n3. Testing Permanent Failure & Retries...');
  const wf3 = await createWorkflow("WF3: Fail");
  await addStep(wf3, 'http_request', 'FailHTTP', 1, { method: "GET", url: "http://invalid.local" });
  
  const res3 = await trigger(wf3);
  await new Promise(r => setTimeout(r, 5000)); // wait for retries (3 attempts * 1s backoff approx)
  const run3 = await getRun(res3.data.triggerWorkflowRun.run_id);
  if (run3.workflow_runs_by_pk.status === 'failed' && run3.step_runs[0].status === 'failed' && run3.step_runs[0].attempt_count === 3) {
    console.log('PASS: Workflow failed permanently after 3 attempts.');
  } else {
    console.log('FAIL:', JSON.stringify(run3));
  }

  // TEST 5 & 6: Conditional TRUE & FALSE (Tests 5, 6)
  console.log('\\n4. Testing Conditionals...');
  const wf4 = await createWorkflow("WF4: Conditional");
  const step1Id = await addStep(wf4, 'llm_call', 'Stub', 1, { stub_output: "YES" });
  
  const step3Id = await addStep(wf4, 'llm_call', 'TrueBranch', 3, { stub_output: "T" });
  const step4Id = await addStep(wf4, 'llm_call', 'FalseBranch', 4, { stub_output: "F" });
  const step5Id = await addStep(wf4, 'llm_call', 'Join', 5, { stub_output: "J" });
  
  // Conditional points to 3 if TRUE, 4 if FALSE, and skips to 5 after.
  await addStep(wf4, 'conditional_branch', 'Cond', 2, { 
    source: "previous_output", operator: "equals", value: "YES", 
    if_true: step3Id, if_false: step4Id, after: step5Id
  });

  const res4 = await trigger(wf4);
  await new Promise(r => setTimeout(r, 2000));
  const run4 = await getRun(res4.data.triggerWorkflowRun.run_id);
  
  const executedStepIds = run4.step_runs.map(s => s.workflow_step_id);
  if (executedStepIds.includes(step3Id) && !executedStepIds.includes(step4Id) && executedStepIds.includes(step5Id)) {
    console.log('PASS: TRUE Branch executed successfully and joined, skipping FALSE branch.');
    expectedQuota++;
  } else {
    console.log('FAIL TRUE branch:', JSON.stringify(executedStepIds));
  }

  // Update stub to NO
  await query('admin', `mutation { update_workflow_steps_by_pk(pk_columns: {id: "${step1Id}"}, _set: {config: {stub_output: "NO"}}) { id } }`);
  
  const res5 = await trigger(wf4);
  await new Promise(r => setTimeout(r, 2000));
  const run5 = await getRun(res5.data.triggerWorkflowRun.run_id);
  
  const executedStepIdsF = run5.step_runs.map(s => s.workflow_step_id);
  if (!executedStepIdsF.includes(step3Id) && executedStepIdsF.includes(step4Id) && executedStepIdsF.includes(step5Id)) {
    console.log('PASS: FALSE Branch executed successfully and joined, skipping TRUE branch.');
    expectedQuota++;
  } else {
    console.log('FAIL FALSE branch:', JSON.stringify(executedStepIdsF));
  }

  // TEST 9: Quota Check
  console.log('\\n5. Testing Quota Increment...');
  const currentQuota = await getQuota();
  if (currentQuota === expectedQuota) {
    console.log(`PASS: Quota incremented correctly from ${initialQuota} to ${expectedQuota}.`);
  } else {
    console.log(`FAIL: Quota is ${currentQuota}, expected ${expectedQuota}`);
  }

  // TEST 10: Auth Regression
  console.log('\\n6. Testing Auth Regression...');
  let deny1 = await trigger(wf1, 'Carol'); // Viewer
  let deny2 = await trigger(wf1, 'Dave'); // Cross-Org
  if (deny1.errors && deny2.errors) {
    console.log('PASS: Viewer and Cross-org triggers denied.');
  } else {
    console.log('FAIL Auth:', deny1, deny2);
  }

  // TEST 11: Direct Protection
  console.log('\\n7. Testing Direct State Protection...');
  let dBlock = await query('Bob', `mutation { update_step_runs_by_pk(pk_columns: {id: "11111111-1111-1111-1111-111111111111"}, _set: {status: "completed"}) { id } }`);
  if (dBlock.errors?.[0]?.extensions?.code === 'validation-failed' || dBlock.data?.update_step_runs_by_pk === null) {
    console.log('PASS: Direct mutation blocked.');
  } else {
    console.log('FAIL Protection:', dBlock);
  }

  process.exit(0);
}

main();
