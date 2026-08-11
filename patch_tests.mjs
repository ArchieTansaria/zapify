import fs from 'fs';

const files = [
  'web/tests/backend/m3-workflow/test-approval.mjs',
  'web/tests/backend/m3-workflow/test-m3-checkpoint.mjs',
  'web/tests/backend/m3-workflow/test-m3-e2e.mjs',
  'web/tests/backend/m3-workflow/test-webhook.mjs'
];

const newGetTokens = `async function getTokens() {
  ids['Alice'] = "723d675a-ea86-4942-9869-7168fb983f36";
  ids['Bob'] = "03f87d98-b856-4761-825b-7dea4f1e1ee9";
  ids['Carol'] = "b7f05cf7-e896-44a9-a1a9-bde33d56d1d5";
  ids['Dave'] = "a9c6a945-8e89-4c47-a796-076f6fd20b84";
  tokens['Alice'] = generateJWT(ids['Alice']);
  tokens['Bob'] = generateJWT(ids['Bob']);
  tokens['Carol'] = generateJWT(ids['Carol']);
  tokens['Dave'] = generateJWT(ids['Dave']);
}`;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = `import { generateJWT } from '../../utils/manual_jwt.js';\n` + content;
  content = content.replace(/async function getTokens\(\) \{[\s\S]*?^\}/m, newGetTokens);
  fs.writeFileSync(file, content);
  console.log("Patched", file);
}
