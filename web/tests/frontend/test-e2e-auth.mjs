import { createClient } from "@nhost/nhost-js";

const nhost = createClient({
  subdomain: "local",
  region: "local"
});

async function run() {
  const email = `test_e2e_${Date.now()}@example.com`;
  const password = "password123!";

  console.log("1. Testing Signup...");
  try {
    const signupRes = await nhost.auth.signUpEmailPassword({
      email,
      password,
      options: { displayName: "E2E Test User" }
    });
    console.log("Signup success, session:", !!signupRes.body?.session);
  } catch (err) {
    console.error("Signup failed:", err.message);
    process.exit(1);
  }

  console.log("2. Testing Signin...");
  let refreshToken;
  try {
    const signinRes = await nhost.auth.signInEmailPassword({
      email,
      password
    });
    const session = signinRes.body?.session;
    console.log("Signin success, session:", !!session);
    if (!session || !session.refreshToken) {
      throw new Error("No session or refresh token returned");
    }
    refreshToken = session.refreshToken;
  } catch (err) {
    console.error("Signin failed:", err.message);
    process.exit(1);
  }

  console.log("3. Testing Signout...");
  try {
    const signoutRes = await nhost.auth.signOut({ refreshToken });
    console.log("Signout success, status:", signoutRes.status);
  } catch (err) {
    console.error("Signout failed:", err.message);
    process.exit(1);
  }
}

run();
