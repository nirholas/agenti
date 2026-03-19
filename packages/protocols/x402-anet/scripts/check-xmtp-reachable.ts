import Database from 'better-sqlite3';
import path from 'path';
import { ethers } from 'ethers';
import { config } from '../src/config.js';

// Check which indexed agents are actually on XMTP
async function main() {
  const { Client } = await import('@xmtp/node-sdk');
  const db = new Database(path.join(process.env.HOME!, '.anet', 'agent-index.db3'));

  // Get top agents with XMTP addresses
  const agents = db.prepare(
    "SELECT agent_id, name, xmtp_address FROM agents WHERE xmtp_address IS NOT NULL AND xmtp_address != '' ORDER BY reputation DESC LIMIT 50"
  ).all() as any[];

  const wallet = new ethers.Wallet(config.privateKey);

  const signer = {
    type: 'EOA' as const,
    signMessage: async (message: string) => {
      const sig = await wallet.signMessage(message);
      return Uint8Array.from(Buffer.from(sig.slice(2), 'hex'));
    },
    getIdentifier: () => ({
      identifier: wallet.address.toLowerCase(),
      identifierKind: 0 as const,
    }),
  };

  const env = (process.env.XMTP_ENV || 'production') as 'production' | 'dev';
  console.log(`Checking XMTP reachability on ${env} network...`);

  const dbDir = path.join(process.env.HOME!, '.anet', 'xmtp');
  const { mkdirSync, existsSync, readFileSync } = await import('fs');
  if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

  const crypto = await import('crypto');
  const keyPath = path.join(dbDir, 'xmtp-encryption-key');
  let encKeyHex: string;
  if (existsSync(keyPath)) {
    encKeyHex = readFileSync(keyPath, 'utf8').trim().replace(/^0x/, '');
  } else {
    encKeyHex = crypto.randomBytes(32).toString('hex');
    const { writeFileSync } = await import('fs');
    writeFileSync(keyPath, encKeyHex, { mode: 0o600 });
  }
  const encryptionKey = Uint8Array.from(Buffer.from(encKeyHex, 'hex'));
  const dbPath = path.join(dbDir, `xmtp-${wallet.address}.db3`);

  const client = await Client.create(signer, { env, dbPath, dbEncryptionKey: encryptionKey });

  // Batch check in groups of 10
  const reachable: any[] = [];
  for (let i = 0; i < agents.length; i += 10) {
    const batch = agents.slice(i, i + 10);
    const identifiers = batch.map((a: any) => ({
      identifier: a.xmtp_address.toLowerCase(),
      identifierKind: 0 as const,
    }));

    const results = await client.canMessage(identifiers);

    for (const a of batch) {
      const canReach = results.get(a.xmtp_address.toLowerCase());
      if (canReach) {
        reachable.push(a);
        console.log(`  [${a.agent_id}] ${a.name || 'Unknown'} — ${a.xmtp_address} ✓`);
      }
    }
  }

  console.log(`\n${reachable.length} of ${agents.length} agents reachable on XMTP ${env}`);
  db.close();
}

main().catch(console.error);
