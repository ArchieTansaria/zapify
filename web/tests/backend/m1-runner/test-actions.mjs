import { WebSocket } from 'ws';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const tokens = {};
const ids = {
  Alice: "723d675a-ea86-4942-9869-7168fb983f36"
};

async function getTokens() {
  const users = [
    { email: 'alice@test.com', password: 'password123', name: 'Alice' }
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

async function query(token, q, variables = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const res = await fetch('https://local.hasura.local.nhost.run/v1/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: q, variables })
  });
  return res.json();
}

function expectSuccess(res) {
  if (res.errors) {
    return `FAIL (Error: ${JSON.stringify(res.errors[0])})`;
  }
  return res.data ? `PASS (Received: ${JSON.stringify(res.data)})` : `FAIL (No data)`;
}

function expectError(res) {
  if (res.errors && res.errors.length > 0) {
    return `PASS (Error: ${JSON.stringify(res.errors[0].message)})`;
  }
  return `FAIL (Expected error, got data: ${JSON.stringify(res.data)})`;
}

async function main() {
  await getTokens();
  console.log('--- 1. Authenticated Invocation ---');
  let q;
  
  q = await query(tokens['Alice'], `mutation { triggerWorkflowRun(workflow_id: "11111111-1111-1111-1111-111111111111") { success } }`);
  console.log('Alice invoking triggerWorkflowRun:', expectSuccess(q));

  q = await query(tokens['Alice'], `mutation { approveStep(step_run_id: "44444444-4444-4444-4444-444444444444") { success } }`);
  console.log('Alice invoking approveStep:', expectSuccess(q));

  console.log('\\n--- 2. Unauthenticated Invocation ---');
  // Pass null for token
  q = await query(null, `mutation { triggerWorkflowRun(workflow_id: "11111111-1111-1111-1111-111111111111") { success } }`);
  console.log('Unauthenticated triggerWorkflowRun:', expectError(q));

  q = await query(null, `mutation { approveStep(step_run_id: "44444444-4444-4444-4444-444444444444") { success } }`);
  console.log('Unauthenticated approveStep:', expectError(q));
  
  process.exit(0);
}

main();
