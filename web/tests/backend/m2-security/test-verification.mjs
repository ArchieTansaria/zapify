import { WebSocket } from 'ws';

const tokens = {};
const ids = {
  Alice: "723d675a-ea86-4942-9869-7168fb983f36",
  Bob: "03f87d98-b856-4761-825b-7dea4f1e1ee9",
  Carol: "b7f05cf7-e896-44a9-a1a9-bde33d56d1d5",
  Dave: "a9c6a945-8e89-4c47-a796-076f6fd20b84"
};

async function getTokens() {
  const users = [
    { email: 'alice@test.com', password: 'password123', name: 'Alice' },
    { email: 'bob@test.com', password: 'password123', name: 'Bob' },
    { email: 'carol@test.com', password: 'password123', name: 'Carol' },
    { email: 'dave@test.com', password: 'password123', name: 'Dave' }
  ];
  for (const u of users) {
    let res = await fetch('https://local.auth.local.nhost.run/v1/signin/email-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.email, password: u.password })
    });
    let data = await res.json();
    tokens[u.name] = data.session.accessToken;
  }
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function query(asUser, q, variables = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (asUser === 'admin') {
    headers['x-hasura-admin-secret'] = 'nhost-admin-secret';
  } else {
    headers['Authorization'] = `Bearer ${tokens[asUser]}`;
  }
  
  const res = await fetch('https://local.hasura.local.nhost.run/v1/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: q, variables })
  });
  return res.json();
}

function expectError(res, expectedError) {
  if (res.errors && res.errors[0]) {
    const isPermissionError = res.errors[0].extensions?.code === 'permission-error';
    return isPermissionError ? 'PASS (Hasura Permission Error)' : `FAIL (Other error: ${JSON.stringify(res.errors[0])})`;
  }
  return `FAIL (Expected error, got data: ${JSON.stringify(res.data)})`;
}

async function runSubscription(asUser, workflow_run_id) {
  return new Promise((resolve) => {
    const ws = new WebSocket('wss://local.hasura.local.nhost.run/v1/graphql', 'graphql-ws', {
      rejectUnauthorized: false
    });
    
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'connection_init',
        payload: { headers: { Authorization: `Bearer ${tokens[asUser]}` } }
      }));
    });

    let receivedData = null;
    let timer = null;

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'connection_ack') {
        ws.send(JSON.stringify({
          id: '1',
          type: 'start',
          payload: {
            query: `subscription { step_runs(where: {workflow_run_id: {_eq: "${workflow_run_id}"}}) { id status } }`
          }
        }));
      } else if (msg.type === 'data') {
        receivedData = msg.payload.data;
        if (timer) clearTimeout(timer);
        ws.close();
        resolve(receivedData);
      } else if (msg.type === 'error') {
        ws.close();
        resolve({ error: msg.payload });
      }
    });

    timer = setTimeout(() => {
      ws.close();
      resolve(null);
    }, 5000); // 5 sec timeout
  });
}

async function main() {
  await getTokens();
  console.log('--- 1. Org Membership Testing ---');
  let q;
  
  // Bob tries to add Dave to Org A
  q = await query('Bob', `mutation { insert_org_members_one(object: {org_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", user_id: "${ids.Dave}", role: "viewer"}) { id } }`);
  console.log('Bob adding member to Org A:', expectError(q));
  
  // Alice adds a dummy user to Org A (using Carol's ID but wait, Carol is already there. Let's add Dave to Org A as viewer)
  q = await query('Alice', `mutation { insert_org_members_one(object: {org_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", user_id: "${ids.Dave}", role: "viewer"}) { id } }`);
  console.log('Alice adding member to Org A:', q.data?.insert_org_members_one?.id ? 'PASS' : `FAIL: ${JSON.stringify(q)}`);
  
  // Clean up Dave from Org A
  if (q.data?.insert_org_members_one) {
     await query('Alice', `mutation { delete_org_members_by_pk(id: "${q.data.insert_org_members_one.id}") { id } }`);
  }

  console.log('\\n--- 2. Restricted Step UPDATE attacks ---');
  // First owner Alice creates a db_write step
  q = await query('Alice', `mutation { insert_workflow_steps_one(object: {workflow_id: "11111111-1111-1111-1111-111111111111", step_type: "db_write", name: "DB Step", step_order: 10}) { id } }`);
  const dbWriteStepId = q.data?.insert_workflow_steps_one?.id;
  
  // Editor Bob tries to update it to http_request
  q = await query('Bob', `mutation { update_workflow_steps_by_pk(pk_columns: {id: "${dbWriteStepId}"}, _set: {step_type: "http_request"}) { id } }`);
  console.log('Bob updating existing db_write step (Denied by filter):', q.data?.update_workflow_steps_by_pk === null ? 'PASS (Not found/Filtered out)' : 'FAIL');
  
  // Editor Bob tries to delete it
  q = await query('Bob', `mutation { delete_workflow_steps_by_pk(id: "${dbWriteStepId}") { id } }`);
  console.log('Bob deleting existing db_write step (Denied by filter):', q.data?.delete_workflow_steps_by_pk === null ? 'PASS (Not found/Filtered out)' : 'FAIL');

  // Bob inserts ordinary step
  q = await query('Bob', `mutation { insert_workflow_steps_one(object: {workflow_id: "11111111-1111-1111-1111-111111111111", step_type: "http_request", name: "HTTP", step_order: 11}) { id } }`);
  const ordinaryStepId = q.data?.insert_workflow_steps_one?.id;
  console.log('Bob inserts ordinary step:', ordinaryStepId ? 'PASS' : `FAIL: ${JSON.stringify(q)}`);
  
  // Bob updates ordinary step to db_write
  q = await query('Bob', `mutation { update_workflow_steps_by_pk(pk_columns: {id: "${ordinaryStepId}"}, _set: {step_type: "db_write"}) { id } }`);
  console.log('Bob updates http_request -> db_write:', expectError(q));
  
  console.log('\\n--- 3. Restricted webhook trigger attacks ---');
  // Bob tries to insert webhook trigger
  q = await query('Bob', `mutation { insert_workflow_triggers_one(object: {workflow_id: "11111111-1111-1111-1111-111111111111", trigger_type: "webhook", config: {}}) { id } }`);
  console.log('Bob inserts webhook trigger:', expectError(q));
  
  // Alice inserts webhook trigger
  q = await query('Alice', `mutation { insert_workflow_triggers_one(object: {workflow_id: "11111111-1111-1111-1111-111111111111", trigger_type: "webhook", config: {}}) { id } }`);
  const webhookTriggerId = q.data?.insert_workflow_triggers_one?.id;
  console.log('Alice inserts webhook trigger:', webhookTriggerId ? 'PASS' : `FAIL: ${JSON.stringify(q)}`);
  
  // Bob tries to delete it
  q = await query('Bob', `mutation { delete_workflow_triggers_by_pk(id: "${webhookTriggerId}") { id } }`);
  console.log('Bob deleting webhook trigger (Denied by filter):', q.data?.delete_workflow_triggers_by_pk === null ? 'PASS (Not found)' : 'FAIL');

  console.log('\\n--- 5. Real GraphQL subscription test ---');
  console.log('Connecting Alice...');
  let subP = runSubscription('Alice', "33333333-3333-3333-3333-333333333333");
  // wait 1 sec to establish connection, then mutate
  setTimeout(async () => {
    await query('admin', `mutation { update_step_runs_by_pk(pk_columns: {id: "44444444-4444-4444-4444-444444444444"}, _set: {status: "failed"}) { id } }`);
  }, 1000);
  let aliceSub = await subP;
  console.log('Alice subscription received data:', aliceSub?.step_runs?.length > 0 ? 'PASS' : 'FAIL', JSON.stringify(aliceSub));
  
  console.log('Connecting Dave...');
  let daveSub = await runSubscription('Dave', "33333333-3333-3333-3333-333333333333");
  console.log('Dave subscription received data:', daveSub?.step_runs?.length === 0 ? 'PASS' : 'FAIL', JSON.stringify(daveSub));

  console.log('\\n--- 6. Direct ID attack matrix (Dave on Org A) ---');
  let d1 = await query('Dave', `query { organizations_by_pk(id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa") { id } }`);
  console.log('Dave direct ID organizations_by_pk:', d1.data?.organizations_by_pk === null ? 'PASS' : 'FAIL');
  
  let d2 = await query('Dave', `query { workflows_by_pk(id: "11111111-1111-1111-1111-111111111111") { id } }`);
  console.log('Dave direct ID workflows_by_pk:', d2.data?.workflows_by_pk === null ? 'PASS' : 'FAIL');

  let d3 = await query('Dave', `query { workflow_steps_by_pk(id: "22222222-2222-2222-2222-222222222222") { id } }`);
  console.log('Dave direct ID workflow_steps_by_pk:', d3.data?.workflow_steps_by_pk === null ? 'PASS' : 'FAIL');

  let d4 = await query('Dave', `query { workflow_runs_by_pk(id: "33333333-3333-3333-3333-333333333333") { id } }`);
  console.log('Dave direct ID workflow_runs_by_pk:', d4.data?.workflow_runs_by_pk === null ? 'PASS' : 'FAIL');
  
  process.exit(0);
}

main();
