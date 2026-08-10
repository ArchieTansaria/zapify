process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // For local self-signed certs

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
    let res = await fetch('https://local.auth.local.nhost.run/v1/signup/email-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.email, password: u.password })
    });
    
    let data;
    try {
      data = await res.json();
    } catch(e) {
      console.error('Failed to parse JSON, status:', res.status);
      continue;
    }
    
    if (res.status !== 200 && (data.error === 'email-already-in-use' || data.message?.includes('already in use'))) {
      res = await fetch('https://local.auth.local.nhost.run/v1/signin/email-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: u.email, password: u.password })
      });
      data = await res.json();
    }
    
    if (res.status !== 200) {
      console.error(`Failed to auth ${u.name}:`, data);
      continue;
    }
    
    tokens[u.name] = data.session.accessToken;
    ids[u.name] = data.session.user.id;
  }
  
  console.log('TOKENS=');
  console.log(JSON.stringify(tokens, null, 2));
  console.log('IDS=');
  console.log(JSON.stringify(ids, null, 2));
}

main();
