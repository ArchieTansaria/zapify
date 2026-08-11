import { createClient } from "@nhost/nhost-js";

const nhost = createClient({
  subdomain: "local",
  region: "local"
});

async function run() {
  try {
    const res = await nhost.auth.signOut({ refreshToken: "mock_token" });
    console.log("SignOut success:", res);
  } catch (err) {
    console.error("SignOut failed:", err.message);
  }
}

run();
