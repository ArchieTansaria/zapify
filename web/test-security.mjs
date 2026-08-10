

const tokens = {
  Alice: "eyJhbGciOiJSUzI1NiIsImtpZCI6IjQ5QzBDRURELTI1NUQtNDNEQS04ODgwLTMwNDQwQjI0Rjc4NCIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODYzNTEzMzUsImh0dHBzOi8vaGFzdXJhLmlvL2p3dC9jbGFpbXMiOnsieC1oYXN1cmEtYWxsb3dlZC1yb2xlcyI6WyJ1c2VyIiwibWUiXSwieC1oYXN1cmEtZGVmYXVsdC1yb2xlIjoidXNlciIsIngtaGFzdXJhLXVzZXItaWQiOiI3MjNkNjc1YS1lYTg2LTQ5NDItOTg2OS03MTY4ZmI5ODNmMzYiLCJ4LWhhc3VyYS11c2VyLWlzLWFub255bW91cyI6ImZhbHNlIn0sImlhdCI6MTc4NjM1MDQzNSwiaXNzIjoiaHR0cHM6Ly9sb2NhbC5hdXRoLmxvY2FsLm5ob3N0LnJ1bi92MSIsInN1YiI6IjcyM2Q2NzVhLWVhODYtNDk0Mi05ODY5LTcxNjhmYjk4M2YzNiJ9.WVFViOPDeypaBsRA7S1dfgJK3o35pVu4XedoBi4MAtLbjXZBEdyu6Z3nYTq79iWgKM2XjppHuTAcchqrfcd4O7TvVoLaA_ZDXU70HYzls_J8z3qkzpwA0X1daGuinl09JbgUfqm3m2Unrl_IL30vTgpea53wl9JcmZf_w5E1ONBijsUJnVR_y0xz3rFh2j0uZfqS8Bnn6Di45Sm_NcQIYdzAqUTITwVhdgngwyv8s0ojV0MyRurmzx2qwzneRACJC7wInC2LWGR9140kS56R-KDifPlGqK5pBM3OgFSZRPjYdQ-BCTwzIfLtElbglwI3DeR1yoDUREHUvy30Io2OpA",
  Bob: "eyJhbGciOiJSUzI1NiIsImtpZCI6IjQ5QzBDRURELTI1NUQtNDNEQS04ODgwLTMwNDQwQjI0Rjc4NCIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODYzNTEzMzUsImh0dHBzOi8vaGFzdXJhLmlvL2p3dC9jbGFpbXMiOnsieC1oYXN1cmEtYWxsb3dlZC1yb2xlcyI6WyJ1c2VyIiwibWUiXSwieC1oYXN1cmEtZGVmYXVsdC1yb2xlIjoidXNlciIsIngtaGFzdXJhLXVzZXItaWQiOiIwM2Y4N2Q5OC1iODU2LTQ3NjEtODI1Yi03ZGVhNGYxZTFlZTkiLCJ4LWhhc3VyYS11c2VyLWlzLWFub255bW91cyI6ImZhbHNlIn0sImlhdCI6MTc4NjM1MDQzNSwiaXNzIjoiaHR0cHM6Ly9sb2NhbC5hdXRoLmxvY2FsLm5ob3N0LnJ1bi92MSIsInN1YiI6IjAzZjg3ZDk4LWI4NTYtNDc2MS04MjViLTdkZWE0ZjFlMWVlOSJ9.ZTQ2Rje_2-Y-naSp2cRCfl4URZNSIevTm73UXarszcGWzqjtRS97wWpjRJXNJ3IncNqCYpRoDMqjTNa8kbAihkzg5-a3OagMTKYbMIIcvZDShkbEidyt7uzuk_opf8wBNVPGl5ygTe1cRpxkM7ao6DrmXXtwPwHrLc4Bo2BNtJ9TtbNe0UTJNMa5lkdAoM-Ot6uSAw2YUqkMVES7n0iQsmxA2yuJjyFAyyROSzhQwyc_d5NPl9FAx9-QcuXyREoYGOJxN5YCjwJqvkBcKjk5MOWnlsvN2LDpeRHwaoQyPu14S0_A-pnXes6019A27nbdhAPUoI3oiXI4i4UxN-WHdQ",
  Carol: "eyJhbGciOiJSUzI1NiIsImtpZCI6IjQ5QzBDRURELTI1NUQtNDNEQS04ODgwLTMwNDQwQjI0Rjc4NCIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODYzNTEzMzUsImh0dHBzOi8vaGFzdXJhLmlvL2p3dC9jbGFpbXMiOnsieC1oYXN1cmEtYWxsb3dlZC1yb2xlcyI6WyJ1c2VyIiwibWUiXSwieC1oYXN1cmEtZGVmYXVsdC1yb2xlIjoidXNlciIsIngtaGFzdXJhLXVzZXItaWQiOiJiN2YwNWNmNy1lODk2LTQ0YTktYTFhOS1iZGUzM2Q1NmQxZDUiLCJ4LWhhc3VyYS11c2VyLWlzLWFub255bW91cyI6ImZhbHNlIn0sImlhdCI6MTc4NjM1MDQzNSwiaXNzIjoiaHR0cHM6Ly9sb2NhbC5hdXRoLmxvY2FsLm5ob3N0LnJ1bi92MSIsInN1YiI6ImI3ZjA1Y2Y3LWU4OTYtNDRhOS1hMWE5LWJkZTMzZDU2ZDFkNSJ9.OJjyQ08zpOjhC1YwJIRgD2kHc0w5oqcXh8V-nkzEpFQMRZ_19gODA-1kLwXBECBPdYJaBjD2uCiJ7VGND7mnT6xHpZCsLKp9AlT3LCFqJy5xN5vnMzYbi1FY-52Bp4ThYcCRt9zl_Xt0ijBG8U9sC5fyDppliW2XsdzW3MnwFaxFW79sX3KnpiPjJVUDq977WRejjH8qdYNq5UIdrerszgmjZ5bR15a8kGyek4ZqAjp-T68WblVRPQfwcZaIOabDkQ4yjUxuREXhdpP-EMuQ5WwEde6ilgWTLC9mJ6faTD_UPmbkKRquRU0SRJslEX9h3Xu-E73PARJZ-5K53gkc6Q",
  Dave: "eyJhbGciOiJSUzI1NiIsImtpZCI6IjQ5QzBDRURELTI1NUQtNDNEQS04ODgwLTMwNDQwQjI0Rjc4NCIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3ODYzNTEzMzUsImh0dHBzOi8vaGFzdXJhLmlvL2p3dC9jbGFpbXMiOnsieC1oYXN1cmEtYWxsb3dlZC1yb2xlcyI6WyJ1c2VyIiwibWUiXSwieC1oYXN1cmEtZGVmYXVsdC1yb2xlIjoidXNlciIsIngtaGFzdXJhLXVzZXItaWQiOiJhOWM2YTk0NS04ZTg5LTRjNDctYTc5Ni0wNzZmNmZkMjBiODQiLCJ4LWhhc3VyYS11c2VyLWlzLWFub255bW91cyI6ImZhbHNlIn0sImlhdCI6MTc4NjM1MDQzNSwiaXNzIjoiaHR0cHM6Ly9sb2NhbC5hdXRoLmxvY2FsLm5ob3N0LnJ1bi92MSIsInN1YiI6ImE5YzZhOTQ1LThlODktNGM0Ny1hNzk2LTA3NmY2ZmQyMGI4NCJ9.CaClKwXnS132XITpMFDS2MVP0izF0iSp08KyT4l0xOEHmSZyMRJFCW1ljGLx5988rYwPYXKy_GzBsIEXJDljnp18JA0xPfc3tyg_kpNqB6mukOayET1XDAOWvBWXvCoJ53zwwLC_H5NgHmlpt3CqHxG_DWbuv2HfVXAPo0kz-1JxtWf_0owxE6GWqR89pwCyBXMCV0OWOylBmTV0mCPpNCjrT12IqNXahXeqXdaHK7gdV_GnY9zN0inZtnyrkGYO_mawVa2CwvCpa3EKOKPW8Hy5l-zoIEwc_QudAIKnE6Uamo3ix_11a55N7UgiSaARx7nyUTjoxygoBOJ_lkd7pw"
};

const ids = {
  Alice: "723d675a-ea86-4942-9869-7168fb983f36",
  Bob: "03f87d98-b856-4761-825b-7dea4f1e1ee9",
  Carol: "b7f05cf7-e896-44a9-a1a9-bde33d56d1d5",
  Dave: "a9c6a945-8e89-4c47-a796-076f6fd20b84"
};

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

async function main() {
  console.log('Seeding DB with admin secret...');
  const seedQ = `
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
                id: "11111111-1111-1111-1111-111111111111",
                name: "Org A Workflow",
                workflow_steps: {
                  data: [
                    { id: "22222222-2222-2222-2222-222222222222", step_type: "llm_call", name: "Step 1", step_order: 1 }
                  ]
                },
                workflow_runs: {
                  data: [
                    {
                      id: "33333333-3333-3333-3333-333333333333",
                      status: "completed",
                      step_runs: {
                        data: [
                          { id: "44444444-4444-4444-4444-444444444444", workflow_step_id: "22222222-2222-2222-2222-222222222222", status: "completed", step_order: 1 }
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
  
  const seedRes = await query('admin', seedQ, {
    aliceId: ids.Alice, bobId: ids.Bob, carolId: ids.Carol, daveId: ids.Dave
  });
  
  console.log('Seed result:', JSON.stringify(seedRes));

  // Security Tests
  console.log('\\n--- Running Security Tests ---');

  // Test 1: Alice (Org A owner) can read Org A
  const t1 = await query('Alice', 'query { organizations { id name } }');
  console.log('Test 1 (Alice read orgs):', t1.data?.organizations.length === 1 && t1.data.organizations[0].name === 'Org A' ? 'PASS' : 'FAIL', JSON.stringify(t1));

  // Test 2: Bob (Org A editor) can edit workflows
  const t2 = await query('Bob', `
    mutation {
      update_workflows_by_pk(pk_columns: {id: "11111111-1111-1111-1111-111111111111"}, _set: {name: "Updated by Bob"}) {
        id name
      }
    }
  `);
  console.log('Test 2 (Bob edit workflow):', t2.data?.update_workflows_by_pk?.name === 'Updated by Bob' ? 'PASS' : 'FAIL', JSON.stringify(t2));

  // Test 3: Carol (Org A viewer) CANNOT edit workflows
  const t3 = await query('Carol', `
    mutation {
      update_workflows_by_pk(pk_columns: {id: "11111111-1111-1111-1111-111111111111"}, _set: {name: "Updated by Carol"}) {
        id name
      }
    }
  `);
  console.log('Test 3 (Carol edit workflow denied):', t3.data?.update_workflows_by_pk === null ? 'PASS' : 'FAIL', JSON.stringify(t3));

  // Test 4: Bob (Org A editor) CANNOT add db_write step
  const t4 = await query('Bob', `
    mutation {
      insert_workflow_steps_one(object: {workflow_id: "11111111-1111-1111-1111-111111111111", step_type: "db_write", name: "DB Step", step_order: 2}) {
        id
      }
    }
  `);
  console.log('Test 4 (Bob add db_write denied):', t4.errors && t4.errors[0].message.includes('check constraint') ? 'PASS' : 'FAIL', JSON.stringify(t4));

  // Test 5: Dave (Org B owner) CANNOT read Org A workflow (isolation)
  const t5 = await query('Dave', 'query { workflows { id name } }');
  console.log('Test 5 (Dave read workflows):', t5.data?.workflows.length === 0 ? 'PASS' : 'FAIL', JSON.stringify(t5));

  // Test 6: Dave CANNOT read Org A workflow by PK (direct ID guessing)
  const t6 = await query('Dave', 'query { workflows_by_pk(id: "11111111-1111-1111-1111-111111111111") { id } }');
  console.log('Test 6 (Dave direct ID workflow):', t6.data?.workflows_by_pk === null ? 'PASS' : 'FAIL', JSON.stringify(t6));
  
  // Test 7: Dave CANNOT read step runs for Org A (for subscription)
  const t7 = await query('Dave', 'query { step_runs(where: {workflow_run_id: {_eq: "33333333-3333-3333-3333-333333333333"}}) { id } }');
  console.log('Test 7 (Dave subscribe step runs):', t7.data?.step_runs.length === 0 ? 'PASS' : 'FAIL', JSON.stringify(t7));
}

main();
