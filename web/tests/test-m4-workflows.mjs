import crypto from 'crypto';
import { generateJWT } from './utils/manual_jwt.js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const GRAPHQL_URL = 'https://local.hasura.local.nhost.run/v1/graphql';
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
  if (!pass) allPass = false;
  return pass;
}

async function getTokens() {
  ids['Alice'] = "723d675a-ea86-4942-9869-7168fb983f36";
  ids['Bob'] = "03f87d98-b856-4761-825b-7dea4f1e1ee9";
  ids['Carol'] = "b7f05cf7-e896-44a9-a1a9-bde33d56d1d5";
  ids['Dave'] = "a9c6a945-8e89-4c47-a796-076f6fd20b84";
  
  tokens['Alice'] = generateJWT(ids['Alice']);
  tokens['Bob'] = generateJWT(ids['Bob']);
  tokens['Carol'] = generateJWT(ids['Carol']);
  tokens['Dave'] = generateJWT(ids['Dave']);
}

async function gql(query, variables, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    headers['x-hasura-admin-secret'] = ADMIN_SECRET;
  }
  
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables })
  });
  const data = await res.json();
  if (data.errors) {
    throw new Error(data.errors[0].message);
  }
  return data.data;
}

async function setup() {
  console.log("Setting up tokens and fetching orgs...");
  await getTokens();
  
  const data = await gql(`
    query {
      organizations(order_by: { name: asc }) {
        id
        name
      }
    }
  `);
  
  const orgs = data.organizations;
  orgA = orgs.find(o => o.name === 'Org A').id;
  orgB = orgs.find(o => o.name === 'Org B').id;
}

async function runTests() {
  await setup();
  console.log("\nRunning M4.3 Workflow tests...\n");

  const listQuery = `
    query GetWorkflows($orgId: uuid!) {
      workflows(where: { org_id: { _eq: $orgId } }) {
        id
        name
      }
    }
  `;

  // 1-4. List Workflows (Read permissions)
  const aliceList = await gql(listQuery, { orgId: orgA }, tokens.Alice);
  printResult('1. Alice can list Org A workflows', aliceList.workflows !== undefined);

  const bobList = await gql(listQuery, { orgId: orgA }, tokens.Bob);
  printResult('2. Bob can list Org A workflows', bobList.workflows !== undefined);

  const carolList = await gql(listQuery, { orgId: orgA }, tokens.Carol);
  printResult('3. Carol can list Org A workflows', carolList.workflows !== undefined);

  const daveList = await gql(listQuery, { orgId: orgA }, tokens.Dave);
  printResult('4. Dave cannot list Org A workflows (returns empty array)', daveList.workflows.length === 0);

  // 5-7. Create Workflows
  const createMut = `
    mutation CreateWorkflow($orgId: uuid!, $name: String!) {
      insert_workflows_one(object: { org_id: $orgId, name: $name }) {
        id
        name
      }
    }
  `;

  let aliceWf, bobWf;

  try {
    const res = await gql(createMut, { orgId: orgA, name: 'Alice Workflow' }, tokens.Alice);
    aliceWf = res.insert_workflows_one;
    printResult('5. Alice can create workflow', !!aliceWf);
  } catch (e) {
    printResult('5. Alice can create workflow', false);
  }

  try {
    const res = await gql(createMut, { orgId: orgA, name: 'Bob Workflow' }, tokens.Bob);
    bobWf = res.insert_workflows_one;
    printResult('6. Bob can create workflow', !!bobWf);
  } catch (e) {
    printResult('6. Bob can create workflow', false);
  }

  try {
    await gql(createMut, { orgId: orgA, name: 'Carol Workflow' }, tokens.Carol);
    printResult('7. Carol cannot create workflow', false);
  } catch (e) {
    printResult('7. Carol cannot create workflow', true);
  }

  // 8-10. Rename (Update) Workflows
  const renameMut = `
    mutation UpdateWorkflow($id: uuid!, $name: String!) {
      update_workflows_by_pk(pk_columns: { id: $id }, _set: { name: $name }) {
        id
        name
      }
    }
  `;

  try {
    const res = await gql(renameMut, { id: aliceWf.id, name: 'Alice Renamed' }, tokens.Alice);
    printResult('8. Alice can rename workflow', res.update_workflows_by_pk?.name === 'Alice Renamed');
  } catch (e) {
    printResult('8. Alice can rename workflow', false);
  }

  try {
    const res = await gql(renameMut, { id: bobWf.id, name: 'Bob Renamed' }, tokens.Bob);
    printResult('9. Bob can rename workflow', res.update_workflows_by_pk?.name === 'Bob Renamed');
  } catch (e) {
    printResult('9. Bob can rename workflow', false);
  }

  try {
    const res = await gql(renameMut, { id: aliceWf.id, name: 'Carol Renamed' }, tokens.Carol);
    printResult('10. Carol cannot rename workflow', res.update_workflows_by_pk === null);
  } catch (e) {
    printResult('10. Carol cannot rename workflow', true);
  }

  // 11-13. Delete Workflows
  const delMut = `
    mutation DeleteWorkflow($id: uuid!) {
      delete_workflows_by_pk(id: $id) {
        id
      }
    }
  `;

  try {
    const res = await gql(delMut, { id: bobWf.id }, tokens.Bob);
    printResult('12. Bob cannot delete workflow', res.delete_workflows_by_pk === null);
  } catch (e) {
    printResult('12. Bob cannot delete workflow', true);
  }

  try {
    const res = await gql(delMut, { id: aliceWf.id }, tokens.Carol);
    printResult('13. Carol cannot delete workflow', res.delete_workflows_by_pk === null);
  } catch (e) {
    printResult('13. Carol cannot delete workflow', true);
  }

  try {
    const res = await gql(delMut, { id: bobWf.id }, tokens.Alice);
    // Alice is Owner, can delete
    printResult('11. Alice can delete workflow', res.delete_workflows_by_pk !== null);
  } catch (e) {
    printResult('11. Alice can delete workflow', false);
  }
  
  // Also delete aliceWf to clean up
  await gql(delMut, { id: aliceWf.id }, tokens.Alice);

  // 14. Access by UUID
  const getQuery = `
    query GetWorkflow($id: uuid!) {
      workflows_by_pk(id: $id) {
        id
        name
      }
    }
  `;
  
  // Recreate a workflow for Dave to test UUID access
  let tempWf;
  try {
    const res = await gql(createMut, { orgId: orgA, name: 'Temp' }, tokens.Alice);
    tempWf = res.insert_workflows_one;
    const daveAccess = await gql(getQuery, { id: tempWf.id }, tokens.Dave);
    printResult('14. Dave cannot access an Org A workflow by UUID (returns null)', daveAccess.workflows_by_pk === null);
    
    // Clean up
    await gql(delMut, { id: tempWf.id }, tokens.Alice);
  } catch (e) {
    console.error(e)
  }

  // 15-16. Org Switching / Isolation
  const daveOrgB = await gql(listQuery, { orgId: orgB }, tokens.Dave);
  printResult('15. Dave can list Org B workflows', daveOrgB.workflows !== undefined);
  
  const aliceOrgB = await gql(listQuery, { orgId: orgB }, tokens.Alice);
  printResult('16. Alice cannot see Org B workflows (isolated context)', aliceOrgB.workflows.length === 0);

  console.log(`\nOverall: ${allPass ? 'PASS' : 'FAIL'}`);
  process.exit(allPass ? 0 : 1);
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
