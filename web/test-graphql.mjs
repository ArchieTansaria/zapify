import { createClient } from "@nhost/nhost-js";

const nhost = createClient({
  subdomain: "local",
  region: "local"
});

async function run() {
  const email = `test_graphql_${Date.now()}@example.com`;
  const password = "password123!";

  await nhost.auth.signUpEmailPassword({ email, password });
  const signinRes = await nhost.auth.signInEmailPassword({ email, password });
  
  const query = `
    query GetUserOrganizations($userId: uuid!) {
      organizations(where: { org_members: { user_id: { _eq: $userId } } }) {
        id
        name
      }
    }
  `;
  try {
    const res = await nhost.graphql.request({
      query,
      variables: { userId: signinRes.body.session.user.id }
    });
    console.log("GraphQL Response:", res.body);
  } catch (err) {
    console.error("GraphQL Error:", err);
  }
}

run();
