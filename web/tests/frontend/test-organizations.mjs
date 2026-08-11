import { createClient } from "@nhost/nhost-js";
import { CookieStorage } from "@nhost/nhost-js/session";

const nhost = createClient({
  subdomain: "local",
  region: "local",
});

async function run() {
  const email = `test_orgs_${Date.now()}@example.com`;
  const password = "password123!";

  await nhost.auth.signUpEmailPassword({ email, password });
  const signinRes = await nhost.auth.signInEmailPassword({ email, password });
  
  const token = signinRes.body.session.accessToken;
  
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
      variables: { userId: signinRes.body.session.user.id },
    });
    console.log("No explicit headers:", res.body);
    
    const res2 = await nhost.graphql.request({
      query,
      variables: { userId: signinRes.body.session.user.id },
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log("Explicit headers:", res2.body);
  } catch (err) {
    console.error("GraphQL Error:", err);
  }
}

run();
