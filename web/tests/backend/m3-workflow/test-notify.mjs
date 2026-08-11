import http from 'http';

const NHOST_GRAPHQL_URL = 'https://local.hasura.local.nhost.run/v1/graphql';

async function login(name) {
  const query = `query { users(where: {email: {_eq: "${name.toLowerCase()}@test.com"}}) { id } }`;
  const res = await fetch(NHOST_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hasura-admin-secret': 'nhost-admin-secret' },
    body: JSON.stringify({ query })
  });
  const data = await res.json();
  return { id: data.data.users[0].id };
}

async function graphql(query, variables = {}, user = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (user && user.id) {
    headers['x-hasura-admin-secret'] = 'nhost-admin-secret';
    headers['x-hasura-role'] = 'user';
    headers['x-hasura-user-id'] = user.id;
  }
  
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

async function getNotifications(runId, user) {
  const query = `query ($runId: uuid!) { notifications(where: {workflow_run_id: {_eq: $runId}}) { id status target message } }`;
  const res = await graphql(query, { runId }, user);
  return res.data?.notifications || [];
}

function printResult(name, pass) {
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name} `);
  return pass;
}

// Deterministic Local Mock Server for receiving notifications
function startLocalServer(port = 9999) {
  return new Promise((resolve) => {
    const payloads = [];
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          payloads.push(JSON.parse(body));
        } catch(e) {
          payloads.push(body);
        }
        res.writeHead(200);
        res.end('OK');
      });
    });
    server.listen(port, '0.0.0.0', () => {
      resolve({
        server,
        payloads,
        close: () => new Promise(r => server.close(r))
      });
    });
  });
}

async function main() {
  let allPass = true;
  console.log('══════════════════════════════════════');
  console.log('       ZAPIFY M4.4 NOTIFY TESTS       ');
  console.log('══════════════════════════════════════\\n');

  // Start mock receiver (using host.docker.internal since Hasura runs in docker locally, 
  // but if tests are run natively, we can use an accessible IP. For Nhost local, the 
  // host machine is accessible via host.docker.internal)
  let testEndpoint = 'http://host.docker.internal:9999';
  const mockServer = await startLocalServer(9999);

  try {
    const alice = await login('Alice'); // owner
    const bob = await login('Bob');     // editor

    // ----------------------------------------------------
    // Test 1: notify layer 2 permissions (Owner vs Editor)
    // ----------------------------------------------------
    const wf1 = await createWorkflow("M4.4: Notify Security", alice);
    
    const bobRes = await addStep(wf1, 'notify', 'Step1', 1, { target_url: testEndpoint, message: "test" }, bob);
    let p1a = bobRes.errors && bobRes.errors[0].message.includes('permission');
    
    const aliceRes = await addStep(wf1, 'notify', 'Step1', 1, { target_url: testEndpoint, message: "test" }, alice);
    let p1b = !aliceRes.errors && aliceRes.data?.insert_workflow_steps_one?.id;
    
    allPass = printResult('Test 1: Only Owner can create notify steps', p1a && p1b) && allPass;

    // ----------------------------------------------------
    // Test 2: Functional Execution & End-to-End Delivery
    // ----------------------------------------------------
    const wf2 = await createWorkflow("M4.4: Notify Exec", alice);
    await addStep(wf2, 'llm_call', 'Mock', 1, { prompt: "Output Hello", stub_output: "Hello World" }, alice);
    await addStep(wf2, 'notify', 'Notify Step', 2, { target_url: testEndpoint, message: "Output: {{previous_output}}" }, alice);
    
    const runId = await runWorkflow(wf2, alice);
    
    // Wait for runner and event trigger to complete
    await new Promise(r => setTimeout(r, 4000)); 
    
    const notifs = await getNotifications(runId, alice);
    console.log("Notifs:", JSON.stringify(notifs, null, 2));
    let p2a = notifs.length === 1 && notifs[0].status === "sent" && notifs[0].message === "Output: Hello World";
    
    console.log("Mock payloads:", JSON.stringify(mockServer.payloads, null, 2));
    let p2b = mockServer.payloads.length >= 1;
    let p2c = p2b && mockServer.payloads.some(p => p.text === "Output: Hello World");
    
    allPass = printResult('Test 2: notify sends payload via Event Trigger (idempotent)', p2a && p2b && p2c) && allPass;

  } catch (e) {
    console.error("Test execution failed:", e);
    allPass = false;
  } finally {
    await mockServer.close();
  }

  console.log('\\n══════════════════════════════════════');
  console.log(`RESULT: ${allPass ? 'PASS' : 'FAIL'}`);
  console.log('══════════════════════════════════════\\n');
  process.exit(allPass ? 0 : 1);
}

main();
