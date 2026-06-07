import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'index.html',
  'src/app.js',
  'src/shell.js',
  'src/main.js',
  'src/styles/app.css',
  'src/config/tailwind.config.js',
  'backend/server.example.js',
  'backend/src/app.js',
  'backend/src/server.js',
  'backend/src/services/cloudflareWalletService.js'
];

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const requiredLinks = [
  '/src/config/tailwind.config.js',
  '/src/styles/app.css',
  '/src/app.js',
  '/src/shell.js',
  '/src/main.js'
];

const missingLinks = requiredLinks.filter((link) => !index.includes(link));

if (missing.length || missingLinks.length) {
  console.error('Project check failed.');
  if (missing.length) console.error(`Missing files: ${missing.join(', ')}`);
  if (missingLinks.length) console.error(`Missing index links: ${missingLinks.join(', ')}`);
  process.exit(1);
}

console.log('Project structure check passed.');
