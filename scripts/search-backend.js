import fs from 'node:fs';
import path from 'node:path';

const searchTerms = [
  'admin.firestore',
  'firestore',
  'admin.auth',
  'upsertFirebaseUser'
];

const backendPath = path.join(process.cwd(), 'backend', 'src', 'services', 'cloudflareWalletService.js');
const content = fs.readFileSync(backendPath, 'utf8');
const lines = content.split('\n');

searchTerms.forEach(term => {
  console.log(`\n=== Matches for "${term}" ===`);
  lines.forEach((line, index) => {
    if (line.toLowerCase().includes(term.toLowerCase())) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  });
});
