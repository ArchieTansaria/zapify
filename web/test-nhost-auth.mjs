import { createClient } from "@nhost/nhost-js";

const nhost = createClient({
  subdomain: "local",
  region: "local"
});

async function run() {
  try {
    const res = await nhost.auth.signUpEmailPassword({
      email: "test_new@example.com",
      password: "123",
      options: {
        displayName: "Test User"
      }
    });
    console.log("Signup success:", res);
  } catch (err) {
    console.error("Signup failed (is it an Error?):", err instanceof Error);
    console.error("Message:", err.message);
    console.error("Payload:", err.payload || err.response?.data);
  }
}

run();
