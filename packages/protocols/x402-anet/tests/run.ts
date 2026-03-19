import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tests = [
  'settings.test.ts',
  'social.test.ts',
  'hooks.test.ts',
  'indexer.test.ts',
  'auth.test.ts',
  'budget.test.ts',
  'skills.test.ts',
  'reputation.test.ts',
  'call-input.test.ts',
  'messaging.test.ts',
];

let totalPassed = 0;
let totalFailed = 0;

for (const test of tests) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Running: ${test}`);
  console.log('='.repeat(50));

  try {
    const output = execSync(`npx tsx ${path.join(__dirname, test)}`, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: 'pipe',
    });
    console.log(output);

    // Parse results from last line
    const match = output.match(/(\d+) passed, (\d+) failed/);
    if (match) {
      totalPassed += parseInt(match[1]);
      totalFailed += parseInt(match[2]);
    }
  } catch (e: any) {
    console.log(e.stdout || '');
    console.error(e.stderr || '');
    totalFailed++;
  }
}

console.log(`\n${'='.repeat(50)}`);
console.log(`TOTAL: ${totalPassed} passed, ${totalFailed} failed`);
console.log('='.repeat(50));

if (totalFailed > 0) process.exit(1);
