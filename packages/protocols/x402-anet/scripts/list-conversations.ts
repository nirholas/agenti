import { ethers } from 'ethers';
import { config } from '../src/config.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

async function main() {
  const { Client } = await import('@xmtp/node-sdk');
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

  const dbDir = path.join(config.home, 'xmtp');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  const keyPath = path.join(dbDir, 'xmtp-encryption-key');
  let encKeyHex: string;
  if (fs.existsSync(keyPath)) {
    encKeyHex = fs.readFileSync(keyPath, 'utf8').trim().replace(/^0x/, '');
  } else {
    encKeyHex = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(keyPath, encKeyHex, { mode: 0o600 });
  }
  const encryptionKey = Uint8Array.from(Buffer.from(encKeyHex, 'hex'));
  const dbPath = path.join(dbDir, `xmtp-${wallet.address}.db3`);

  const client = await Client.create(signer, {
    env: 'production',
    dbPath,
    dbEncryptionKey: encryptionKey,
  });

  console.log('Inbox ID:', client.inboxId);
  console.log('Address:', wallet.address);
  console.log('\nSyncing conversations...');

  await client.conversations.sync();
  const convos = await client.conversations.list();

  console.log(`\nFound ${convos.length} conversations:\n`);

  for (const c of convos) {
    const type = c.constructor?.name || 'Unknown';
    console.log(`  [${type}] id: ${c.id}`);
    try {
      // Try to get members for groups
      if ('members' in c) {
        const members = await (c as any).members();
        console.log(`    Members: ${members.length}`);
        for (const m of members) {
          console.log(`      - ${m.inboxId} (${m.accountIdentifiers?.[0]?.identifier || '?'})`);
        }
      }
      // Get last message
      const msgs = await c.messages({ limit: 1n });
      if (msgs.length > 0) {
        const last = msgs[0];
        const content = typeof last.content === 'string' ? last.content : JSON.stringify(last.content);
        console.log(`    Last msg: ${content.substring(0, 80)}`);
      }
    } catch (e: any) {
      console.log(`    (error: ${e.message})`);
    }
    console.log();
  }
}

main().catch(console.error);
