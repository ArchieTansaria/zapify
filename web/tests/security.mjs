import { NhostClient } from '@nhost/nhost-js';
import assert from 'assert';

const nhost = new NhostClient({
  subdomain: 'local',
  region: 'local'
});

const adminHeaders = {
  'x-hasura-admin-secret': 'nhost-admin-secret'
};

async function executeGraphQL(query, variables = {}, headers = {}) {
  const response = await fetch('https://local.hasura.local.nhost.run/v1/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify({ query, variables })
  });
  const data = await response.json();
  if (data.errors) {
    throw new Error(`GraphQL Error: ${JSON.stringify(data.errors)}`);
  }
  return data.data;
}

async function createUser(email, password) {
  const { session, error } = await nhost.auth.signUp({ email, password });
  if (error) {
    if (error.message.includes('already exists')) {
      const login = await nhost.auth.signIn({ email, password });
      return login.session;
    }
    throw error;
  }
  return session;
}

async function runTests() {
  console.log("Setting up users...");
  const aliceSession = await createUser('alice@example.com', 'password123');
  const bobSession = await createUser('bob@example.com', 'password123');
  const carolSession = await createUser('carol@example.com', 'password123');
  const daveSession = await createUser('dave@example.com', 'password123');
  
  console.log("Cleaning up database...");
  await executeGraphQL(`mutation { delete_organizations(where: {}) { affected_rows } }`, {}, adminHeaders);

  console.log("Setting up organizations and members...");
  const setupMutation = `
    mutation {
      insert_organizations(objects: [
        {
          name: "Org A",
          org_members: {
            data: [
              { user_id: "${aliceSession.user.id}", role: "owner" },
              { user_id: "${bobSession.user.id}", role: "editor" },
              { user_id: "${carolSession.user.id}", role: "viewer" }
            ]
          },
          workflows: {
            data: [
              {
                name: "Org A Workflow",
                workflow_steps: { data: [{ name: "Step 1", step_type: "http_request", step_order: 1 }] },
                workflow_runs: {
                  data: [
                    {
                      status: "running",
                      step_runs: { data: [{ status: "pending", step_order: 1 }] }
                    }
                  ]
                }
              }
            ]
          }
        },
        {
          name: "Org B",
          org_members: {
            data: [
              { user_id: "${daveSession.user.id}", role: "owner" }
            ]
          }
        }
      ]) {
        returning {
          id
          name
          workflows {
            id
            workflow_steps { id }
            workflow_runs { id step_runs { id } }
          }
        }
      }
    }
  `;
  
  const setupResult = await executeGraphQL(setupMutation, {}, adminHeaders);
  const orgA = setupResult.insert_organizations.returning.find(o => o.name === 'Org A');
  const orgB = setupResult.insert_organizations.returning.find(o => o.name === 'Org B');
  const orgAWorkflow = orgA.workflows[0];
  const orgAWorkflowStep = orgAWorkflow.workflow_steps[0];
  const orgAWorkflowRun = orgAWorkflow.workflow_runs[0];
  const orgAStepRun = orgAWorkflowRun.step_runs[0];

  const getHeaders = (session) => ({
    'Authorization': `Bearer ${session.accessToken}`
  });

  const queryAll = `
    query {
      organizations { id }
      workflows { id }
      workflow_steps { id }
      workflow_runs { id }
      step_runs { id }
    }
  `;

  console.log("Running Security Tests...");

  // Test 1: Dave cannot read Org A
  console.log("Test: Dave (Org B) cannot read Org A data via collection queries");
  const daveData = await executeGraphQL(queryAll, {}, getHeaders(daveSession));
  assert(!daveData.organizations.some(o => o.id === orgA.id), "Dave can see Org A");
  assert(!daveData.workflows.some(w => w.id === orgAWorkflow.id), "Dave can see Org A workflow");
  assert(!daveData.workflow_steps.some(w => w.id === orgAWorkflowStep.id), "Dave can see Org A step");
  assert(!daveData.workflow_runs.some(w => w.id === orgAWorkflowRun.id), "Dave can see Org A run");
  assert(!daveData.step_runs.some(s => s.id === orgAStepRun.id), "Dave can see Org A step run");

  // Test 2: Alice can read Org A
  console.log("Test: Alice (Org A Owner) can read Org A data");
  const aliceData = await executeGraphQL(queryAll, {}, getHeaders(aliceSession));
  assert(aliceData.organizations.some(o => o.id === orgA.id), "Alice cannot see Org A");
  assert(aliceData.workflows.some(w => w.id === orgAWorkflow.id), "Alice cannot see Org A workflow");

  // Test 3: Carol (Viewer) cannot mutate
  console.log("Test: Carol (Org A Viewer) cannot modify Org A workflow");
  try {
    await executeGraphQL(`mutation { update_workflows_by_pk(pk_columns: {id: "${orgAWorkflow.id}"}, _set: {name: "Hacked"}) { id } }`, {}, getHeaders(carolSession));
    assert(false, "Carol was able to mutate");
  } catch (e) {
    assert(e.message.includes("GraphQL Error"), "Expected a GraphQL error for mutation");
  }

  // Test 4: Bob (Editor) cannot mutate org members
  console.log("Test: Bob (Org A Editor) cannot manage members");
  try {
    await executeGraphQL(`mutation { insert_org_members_one(object: {org_id: "${orgA.id}", user_id: "${daveSession.user.id}", role: "viewer"}) { id } }`, {}, getHeaders(bobSession));
    assert(false, "Bob was able to add a member");
  } catch (e) {
    assert(e.message.includes("GraphQL Error"), "Expected a GraphQL error for member insertion");
  }

  // Test 5: Direct ID Guessing (Dave accessing Org A by PK)
  console.log("Test: Direct ID Guessing by Dave must fail");
  const directIdQuery = `
    query {
      workflows_by_pk(id: "${orgAWorkflow.id}") { id }
      workflow_steps_by_pk(id: "${orgAWorkflowStep.id}") { id }
      workflow_runs_by_pk(id: "${orgAWorkflowRun.id}") { id }
      step_runs_by_pk(id: "${orgAStepRun.id}") { id }
    }
  `;
  const daveDirect = await executeGraphQL(directIdQuery, {}, getHeaders(daveSession));
  assert(daveDirect.workflows_by_pk === null, "Dave accessed workflow directly");
  assert(daveDirect.workflow_steps_by_pk === null, "Dave accessed step directly");
  assert(daveDirect.workflow_runs_by_pk === null, "Dave accessed run directly");
  assert(daveDirect.step_runs_by_pk === null, "Dave accessed step run directly");

  console.log("✅ All tests passed!");
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
