import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import path from 'path';

const envPath = path.resolve(__dirname, '../.env');

let secret: string | undefined;

try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key === 'JWT_SECRET') { secret = value; break; }
  }
} catch {
  console.error('Could not read .env file at:', envPath);
  process.exit(1);
}

if (!secret) {
  console.error('JWT_SECRET not found in .env');
  process.exit(1);
}

const token = jwt.sign(
  { userId: 'dev-user-001', email: 'dev@chronos.local' },
  secret,
  { expiresIn: '7d' }
);

process.stdout.write('\nCopy this Bearer token into your .http files:\n\n');
process.stdout.write('Bearer ' + token + '\n\n');
