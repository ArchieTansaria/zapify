const NHOST_GRAPHQL_URL = 'https://local.hasura.local.nhost.run/v1/graphql';

// Using known Alice/Bob ids from test-setup.mjs or we can fetch them via a query
// But wait, it's easier to just use the tokens like the other tests do if we can read them,
// or we can just fetch the login endpoint.

async function login(name, password = 'password123') {
  const res = await fetch('https://local.auth.local.nhost.run/v1/signin/email-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `${name.toLowerCase()}@test.com`, password })
  });
  const data = await res.json();
  return { token: data.session?.accessToken, id: data.session?.user?.id };
}

async function graphql(query, variables = {}, user = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (user && user.token) headers['Authorization'] = `Bearer ${user.token}`;
  
  const res = await fetch(NHOST_GRAPHQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables })
  });
  return await res.json();
}

async function createWorkflow(name, user) {
  const query = `
    mutation ($name: String!, $orgId: uuid!) {
      insert_workflows_one(object: { name: $name, org_id: $orgId }) { id }
    }
  `;
  const orgQ = `query { organizations { id } }`;
  const orgRes = await graphql(orgQ, {}, user);
  const orgId = orgRes.data.organizations[0].id;
  const res = await graphql(query, { name, orgId }, user);
  return res.data.insert_workflows_one.id;
}

async function addStep(workflowId, type, name, order, config, user) {
  const query = `
    mutation ($wfId: uuid!, $type: step_type!, $name: String!, $order: Int!, $config: jsonb!) {
      insert_workflow_steps_one(object: {
        workflow_id: $wfId, step_type: $type, name: $name, step_order: $order, config: $config
      }) { id }
    }
  `;
  const res = await graphql(query, { wfId: workflowId, type, name, order, config }, user);
  return res;
}

async function runWorkflow(workflowId, user) {
  const query = `mutation ($wfId: uuid!) { triggerWorkflowRun(workflow_id: $wfId) { success run_id } }`;
  const res = await graphql(query, { wfId: workflowId }, user);
  return res.data?.triggerWorkflowRun?.run_id;
}

async function getCustomData(workflowId, user) {
  const query = `query ($wfId: uuid!) { workflow_custom_data(where: {workflow_id: {_eq: $wfId}}) { data } }`;
  const res = await graphql(query, { wfId: workflowId }, user);
  return res.data?.workflow_custom_data || [];
}

function printResult(name, pass) {
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name} `);
  return pass;
}

async function main() {
  let allPass = true;
  console.log('══════════════════════════════════════');
  console.log('       ZAPIFY M4.4 DB_WRITE TESTS     ');
  console.log('══════════════════════════════════════\\n');

  try {
    const alice = await login('Alice'); // owner
    const bob = await login('Bob');     // editor

    // ----------------------------------------------------
    // Test 1: db_write layer 2 permissions (Owner vs Editor)
    // ----------------------------------------------------
    const wf1 = await createWorkflow("M4.4: DB Write Security", alice);
    
    // Bob (Editor) tries to add db_write
    const bobRes = await addStep(wf1, 'db_write', 'Step1', 1, { payload: "test" }, bob);
    let p1a = bobRes.errors && bobRes.errors[0].message.includes('permission');
    
    // Alice (Owner) tries to add db_write
    const aliceRes = await addStep(wf1, 'db_write', 'Step1', 1, { payload: "test" }, alice);
    let p1b = !aliceRes.errors && aliceRes.data?.insert_workflow_steps_one?.id;
    
    allPass = printResult('Test 1: Only Owner can create db_write steps', p1a && p1b) && allPass;

    // ----------------------------------------------------
    // Test 2: Functional Execution
    // ----------------------------------------------------
    const wf2 = await createWorkflow("M4.4: DB Write Exec", alice);
    await addStep(wf2, 'db_write', 'DB Write Step', 1, { payload: { customer: "acme", status: "active" } }, alice);
    
    const runId = await runWorkflow(wf2, alice);
    console.log("Run ID 2:", runId);
    
    await new Promise(r => setTimeout(r, 2000)); // wait for execution
    
    const data = await getCustomData(wf2, alice);
    console.log("Data 2:", JSON.stringify(data, null, 2));
    let p2 = data.length === 1 && data[0].data.customer === "acme" && data[0].data.status === "active";
    allPass = printResult('Test 2: db_write successfully saves data', p2) && allPass;

    // ----------------------------------------------------
    // Test 3: Template Support
    // ----------------------------------------------------
    const wf3 = await createWorkflow("M4.4: DB Write Template", alice);
    await addStep(wf3, 'llm_call', 'Mock', 1, { prompt: "Return fixed", stub_output: "Hello World" }, alice);
    await addStep(wf3, 'db_write', 'Write', 2, { payload: { msg: "{{previous_output}}" } }, alice);
    
    const runId3 = await runWorkflow(wf3, alice);
    console.log("Run ID 3:", runId3);
    await new Promise(r => setTimeout(r, 2000));
    
    const data3 = await getCustomData(wf3, alice);
    console.log("Data 3:", JSON.stringify(data3, null, 2));
    let p3 = data3.length === 1 && data3[0].data.msg === "Hello World";
    allPass = printResult('Test 3: db_write supports {{previous_output}} templating', p3) && allPass;

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
