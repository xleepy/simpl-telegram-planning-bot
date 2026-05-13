import { execSync } from 'child_process';
import { createServer } from './server';
import { createBot } from './bot';

const PORT = parseInt(process.env.PORT || '3001', 10);

try {
  execSync('npx drizzle-kit push', { stdio: 'pipe' });
  console.log('DB schema synced');
} catch {
  console.warn('DB push failed (may already be up-to-date)');
}

createServer(PORT);
createBot();

console.log(`Planning Assistant started`);
console.log(`HTTP + WS : http://localhost:${PORT}`);
console.log(`Bot       : polling mode`);
