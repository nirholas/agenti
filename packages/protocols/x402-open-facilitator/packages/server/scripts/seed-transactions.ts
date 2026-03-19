#!/usr/bin/env npx tsx
/**
 * Seed script to generate test transaction data for development
 *
 * Usage:
 *   npx tsx scripts/seed-transactions.ts <facilitator_id> [count]
 *
 * Example:
 *   npx tsx scripts/seed-transactions.ts snvKwa87ICyCX3LN0G9i4 100
 */

import { getDatabase, initializeDatabase } from '../src/db/index.js';
import { getFacilitatorById } from '../src/db/facilitators.js';
import { nanoid } from 'nanoid';

// Random Solana-like addresses
function randomSolanaAddress(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 44; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Random Solana-like transaction hash
function randomSolanaTxHash(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 88; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate random amount in atomic units (USDC has 6 decimals)
function randomAmount(): string {
  // Random between $0.10 and $50.00
  const dollars = 0.1 + Math.random() * 49.9;
  return Math.floor(dollars * 1_000_000).toString();
}

// Generate a random date within the last N days
function randomDateWithinDays(days: number): Date {
  const now = new Date();
  const msAgo = Math.floor(Math.random() * days * 24 * 60 * 60 * 1000);
  return new Date(now.getTime() - msAgo);
}

// Format date for SQLite
function formatSqliteDate(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
}

async function seedTransactions(facilitatorId: string, count: number) {
  // Initialize database
  initializeDatabase();
  const db = getDatabase();

  // Verify facilitator exists
  const facilitator = getFacilitatorById(facilitatorId);
  if (!facilitator) {
    console.error(`Facilitator not found: ${facilitatorId}`);
    process.exit(1);
  }

  console.log(`Seeding ${count} transactions for facilitator: ${facilitator.name} (${facilitatorId})`);

  const toAddress = randomSolanaAddress(); // Facilitator's wallet
  const networks = ['solana'];

  // Prepare statement
  const stmt = db.prepare(`
    INSERT INTO transactions (id, facilitator_id, type, network, from_address, to_address, amount, asset, transaction_hash, status, error_message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let verifyCount = 0;
  let settleCount = 0;
  let failedCount = 0;

  // Generate transactions with realistic patterns
  for (let i = 0; i < count; i++) {
    const id = nanoid();
    const isVerify = Math.random() < 0.5; // 50% verify, 50% settle
    const type = isVerify ? 'verify' : 'settle';
    const network = networks[Math.floor(Math.random() * networks.length)];
    const fromAddress = randomSolanaAddress();
    const amount = randomAmount();
    const asset = 'usdc';

    // 95% success rate
    const isFailed = Math.random() < 0.05;
    const status = isFailed ? 'failed' : 'success';
    const transactionHash = (!isVerify && !isFailed) ? randomSolanaTxHash() : null;
    const errorMessage = isFailed ? 'Insufficient funds' : null;

    // Random date within last 30 days, weighted towards recent
    const daysAgo = Math.floor(Math.pow(Math.random(), 2) * 30); // Exponential distribution - more recent transactions
    const createdAt = randomDateWithinDays(daysAgo + 1);

    stmt.run(
      id,
      facilitatorId,
      type,
      network,
      fromAddress.toLowerCase(),
      toAddress.toLowerCase(),
      amount,
      asset,
      transactionHash,
      status,
      errorMessage,
      formatSqliteDate(createdAt)
    );

    if (type === 'verify') verifyCount++;
    else settleCount++;
    if (isFailed) failedCount++;
  }

  console.log(`\nSeeded transactions:`);
  console.log(`  Verifications: ${verifyCount}`);
  console.log(`  Settlements: ${settleCount}`);
  console.log(`  Failed: ${failedCount}`);
  console.log(`\nDone!`);
}

// Parse command line args
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('Usage: npx tsx scripts/seed-transactions.ts <facilitator_id> [count]');
  console.log('Example: npx tsx scripts/seed-transactions.ts snvKwa87ICyCX3LN0G9i4 100');
  process.exit(1);
}

const facilitatorId = args[0];
const count = parseInt(args[1] || '100', 10);

seedTransactions(facilitatorId, count);
