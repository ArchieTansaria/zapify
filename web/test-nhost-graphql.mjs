import { createClient } from "@nhost/nhost-js";

const nhost = createClient({
  subdomain: "local",
  region: "local"
});

async function run() {
  try {
    const email = `test_graphql_${Date.now()}@example.com`;
    const resAuth = await nhost.auth.signUpEmailPassword({ email, password: "password123!", options: { displayName: "Tester" } });
    console.log("Signup returned session:", !!resAuth.body?.session);

    // Try graphql request
    const res = await nhost.graphql.request({
      query: `query { organizations { id name } }`
    });
    console.log("GraphQL Status:", res.status);
    console.log("GraphQL Errors:", res.body.errors);
  } catch (err) {
    console.error("Error:", err.message);
  }
}
run();
