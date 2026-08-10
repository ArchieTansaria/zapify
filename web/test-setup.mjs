import { createClient } from '@nhost/nhost-js';

const nhost = createClient({
  subdomain: 'local',
  region: 'local'
});

async function main() {
  const users = [
    { email: 'alice@test.com', password: 'password123', name: 'Alice' },
    { email: 'bob@test.com', password: 'password123', name: 'Bob' },
    { email: 'carol@test.com', password: 'password123', name: 'Carol' },
    { email: 'dave@test.com', password: 'password123', name: 'Dave' }
  ];

  const tokens = {};
  const ids = {};

  for (const u of users) {
    let res = await nhost.auth.signUp({
      email: u.email,
      password: u.password
    });
    
    // If user already exists from a previous run, just sign in
    if (res.error && res.error.message.includes('already exists')) {
      res = await nhost.auth.signIn({
        email: u.email,
        password: u.password
      });
    } else if (res.error) {
      console.error('Error signing up:', u.email, res.error);
      continue;
    }
    
    tokens[u.name] = res.session?.accessToken;
    ids[u.name] = res.session?.user.id;
  }

  console.log('--- TOKENS ---');
  console.log(JSON.stringify(tokens, null, 2));
  
  console.log('--- USER IDS ---');
  console.log(JSON.stringify(ids, null, 2));

  // Now seed the database using admin secret via GraphQL
  const seedQuery = `
    mutation SeedData($aliceId: uuid!, $bobId: uuid!, $carolId: uuid!, $daveId: uuid!) {
      insert_organizations(objects: [
        {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          name: "Org A",
          quota_limit: 1000,
          org_members: {
            data: [
              { user_id: $aliceId, role: "owner" },
              { user_id: $bobId, role: "editor" },
              { user_id: $carolId, role: "viewer" }
            ]
          },
          workflows: {
            data: [
              {
                id: "00000000-0000-0000-0000-000000000001",
                name: "Org A Workflow",
                workflow_steps: {
                  data: [
                    { id: "00000000-0000-0000-0000-000000000002", step_type: "llm_call", name: "Step 1", step_order: 1 }
                  ]
                },
                workflow_runs: {
                  data: [
                    {
                      id: "00000000-0000-0000-0000-000000000003",
                      status: "completed",
                      step_runs: {
                        data: [
                          { id: "00000000-0000-0000-0000-000000000004", workflow_step_id: "00000000-0000-0000-0000-000000000002", status: "completed", step_order: 1 }
                        ]
                      }
                    }
                  ]
                }
              }
            ]
          }
        },
        {
          id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          name: "Org B",
          quota_limit: 1000,
          org_members: {
            data: [
              { user_id: $daveId, role: "owner" }
            ]
          }
        }
      ], on_conflict: { constraint: organizations_pkey, update_columns: [name] }) {
        affected_rows
      }
    }
  `;

  const seedRes = await fetch('http://localhost:8080/v1/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': 'nhost-admin-secret'
    },
    body: JSON.stringify({
      query: seedQuery,
      variables: {
        aliceId: ids.Alice,
        bobId: ids.Bob,
        carolId: ids.Carol,
        daveId: ids.Dave
      }
    })
  });
  
  const seedData = await seedRes.json();
  console.log('--- SEED RESULT ---');
  console.log(JSON.stringify(seedData, null, 2));

  process.exit(0);
}

main();
