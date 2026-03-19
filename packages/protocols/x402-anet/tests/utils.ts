import fs from 'fs';
import path from 'path';
import os from 'os';

let passed = 0;
let failed = 0;

export function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

export function results(): { passed: number; failed: number } {
  return { passed, failed };
}

export function summary(): void {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

export function tmpDir(prefix: string): string {
  const dir = path.join(os.tmpdir(), `anet-${prefix}-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function cleanup(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
}
