import fs from 'fs';
let code = fs.readFileSync('test-verification.mjs', 'utf8');
code = code.replace(/\\\${/g, '${');
fs.writeFileSync('test-verification.mjs', code);
