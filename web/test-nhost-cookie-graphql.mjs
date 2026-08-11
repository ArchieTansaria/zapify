import { createClient } from "@nhost/nhost-js";
import { CookieStorage } from "@nhost/nhost-js/session";

const nhost = createClient({
  subdomain: "local",
  region: "local",
  storage: new CookieStorage({ secure: false })
});

async function run() {
  try {
    const email = `test_cookie_${Date.now()}@example.com`;
    await nhost.auth.signUpEmailPassword({ email, password: "password123!", options: { displayName: "Cookie Tester" } });
    
    // Simulate browser reload
    console.log("Session present after signup:", !!nhost.getUserSession());
    
    const res = await nhost.graphql.request({
      query: `query { organizations { id name } }`
    });
    console.log("GraphQL Status:", res.status);
    if (res.body.errors) {
      console.log("GraphQL Errors:", res.body.errors);
    } else {
      console.log("GraphQL Success");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
