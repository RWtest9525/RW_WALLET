import fs from 'node:fs';
import path from 'node:path';

const searchTerms = [
  'const appId =',
  'let appId =',
  'var appId =',
  'appId ='
];

const mainPath = path.join(process.cwd(), 'src', 'main.js');
const content = fs.readFileSync(mainPath, 'utf8');
const lines = content.split('\n');

searchTerms.forEach(term => {
  console.log(`\n=== Matches for "${term}" ===`);
  lines.forEach((line, index) => {
    if (line.toLowerCase().includes(term.toLowerCase())) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  });
});
