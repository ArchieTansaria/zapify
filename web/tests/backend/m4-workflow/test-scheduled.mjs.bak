
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

async function addTrigger(workflowId, type, config, user) {
  const query = `
    mutation ($wfId: uuid!, $type: trigger_type!, $config: jsonb!) {
      insert_workflow_triggers_one(object: {
        workflow_id: $wfId, trigger_type: $type, config: $config, is_active: true
      }) { id }
    }
  `;
  const res = await graphql(query, { wfId: workflowId, type, config }, user);
  return res;
}

async function getWorkflowRuns(workflowId, user) {
  const query = `
    query ($wfId: uuid!) {
      workflow_runs(where: {workflow_id: {_eq: $wfId}}, order_by: {created_at: desc}) {
        id
        status
        trigger_type
      }
    }
  `;
  const res = await graphql(query, { wfId: workflowId }, user);
  return res.data?.workflow_runs || [];
}

async function getTrigger(triggerId, user) {
  const query = `
    query ($id: uuid!) {
      workflow_triggers_by_pk(id: $id) {
        id
        config
      }
    }
  `;
  const res = await graphql(query, { id: triggerId }, user);
  return res.data?.workflow_triggers_by_pk;
}

function printResult(name, pass) {
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name} `);
  return pass;
}

async function main() {
  let allPass = true;
  console.log('══════════════════════════════════════');
  console.log('    ZAPIFY M4.4 SCHEDULED EVENT TESTS ');
  console.log('══════════════════════════════════════\n');

  try {
    const alice = await login('Alice'); // owner

    // ----------------------------------------------------
    // Test 1: Config & Initialization
    // ----------------------------------------------------
    const wf1 = await createWorkflow("Scheduled Config", alice);
    const triggerRes = await addTrigger(wf1, 'scheduled', { cron: '*/5 * * * *' }, alice);
    const triggerId = triggerRes.data?.insert_workflow_triggers_one?.id;
    let p1a = !!triggerId;
    
    // Wait for Hasura event trigger to run syncScheduledTrigger
    await new Promise(r => setTimeout(r, 2000));
    
    const triggerData = await getTrigger(triggerId, alice);
    const runId = triggerData.config.scheduled_run_id;
    let p1b = !!runId; // UUID should be generated
    
    allPass = printResult('Test 1: Scheduled trigger gets initialized with run ID', p1a && p1b) && allPass;

    // ----------------------------------------------------
    // Test 2: Execution via handleScheduledEvent
    // ----------------------------------------------------
    // Simulate time passing by invoking the webhook directly
    const testPayload = {
      payload: {
        trigger_id: triggerId,
        scheduled_run_id: runId
      }
    };
    
    await fetch('https://local.functions.local.nhost.run/v1/handleScheduledEvent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-nhost-webhook-secret': 'nhost-webhook-secret' },
      body: JSON.stringify(testPayload)
    });
    
    await new Promise(r => setTimeout(r, 2000));
    const runs = await getWorkflowRuns(wf1, alice);
    let p2a = runs.length === 1 && runs[0].trigger_type === 'scheduled';
    
    const triggerDataAfter = await getTrigger(triggerId, alice);
    const runIdAfter = triggerDataAfter.config.scheduled_run_id;
    let p2b = runIdAfter !== runId; // UUID should be rotated to prevent dupes
    
    allPass = printResult('Test 2: Scheduled tick executes workflow and rotates ID', p2a && p2b) && allPass;

    // ----------------------------------------------------
    // Test 3: Obsolete/Stale ID Rejection
    // ----------------------------------------------------
    // If the old event fires again, it should be ignored
    await fetch('https://local.functions.local.nhost.run/v1/handleScheduledEvent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-nhost-webhook-secret': 'nhost-webhook-secret' },
      body: JSON.stringify(testPayload)
    });
    
    await new Promise(r => setTimeout(r, 1000));
    const runsAfter = await getWorkflowRuns(wf1, alice);
    let p3a = runsAfter.length === 1; // Count should NOT increase!
    
    allPass = printResult('Test 3: Stale event is ignored (idempotent)', p3a) && allPass;

  } catch (e) {
    console.error("Test execution failed:", e);
    allPass = false;
  }

  console.log('\n══════════════════════════════════════');
  console.log(`RESULT: ${allPass ? 'PASS' : 'FAIL'}`);
  console.log('══════════════════════════════════════\n');
  process.exit(allPass ? 0 : 1);
}

main();
