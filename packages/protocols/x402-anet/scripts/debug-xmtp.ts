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

  console.log('=== XMTP Debug ===\n');
  console.log('SDK version:', JSON.parse(fs.readFileSync(
    path.join(process.cwd(), 'node_modules/@xmtp/node-sdk/package.json'), 'utf8'
  )).version);
  console.log('Bindings version:', JSON.parse(fs.readFileSync(
    path.join(process.cwd(), 'node_modules/@xmtp/node-bindings/package.json'), 'utf8'
  )).version);

  const client = await Client.create(signer, {
    env: 'production',
    dbPath,
    dbEncryptionKey: encryptionKey,
  });

  console.log('\nClient info:');
  console.log('  Inbox ID:', client.inboxId);
  console.log('  Address:', wallet.address);
  console.log('  Installation ID:', client.installationId ? Buffer.from(client.installationId).toString('hex').substring(0, 16) + '...' : 'none');

  // Check inbox state
  try {
    const inboxState = await client.inboxState(true);
    console.log('\nInbox state:');
    console.log('  Recovery identifier:', JSON.stringify(inboxState.recoveryIdentifier));
    console.log('  Installations:', inboxState.installations?.length || 0);
    console.log('  Identifiers:', JSON.stringify(inboxState.identifiers));
  } catch (e: any) {
    console.log('\nInbox state error:', e.message);
  }

  // Sync and list conversations
  console.log('\nSyncing...');
  await client.conversations.sync();
  const convos = await client.conversations.list();
  console.log(`Found ${convos.length} conversations\n`);

  // Target: lincoln2.base.eth = 0x60b0C1877965529E860560297150145a6f82e2d4
  const targetAddr = '0x60b0c1877965529e860560297150145a6f82e2d4';

  for (const c of convos) {
    const type = c.constructor?.name || 'Unknown';
    console.log(`--- Conversation [${type}] ${c.id} ---`);

    try {
      if ('members' in c) {
        const members = await (c as any).members();
        const memberAddrs = members.map((m: any) =>
          m.accountIdentifiers?.[0]?.identifier || m.inboxId
        );
        console.log('  Members:', memberAddrs.join(', '));

        const isTarget = memberAddrs.some((a: string) =>
          a.toLowerCase() === targetAddr
        );
        if (isTarget) console.log('  ** This is the lincoln2 conversation **');
      }
    } catch (e: any) {
      console.log('  Members error:', e.message);
    }

    // List messages with correct types
    try {
      const msgs = await c.messages({ limit: 5 });
      console.log(`  Messages: ${msgs.length}`);
      for (const m of msgs) {
        const content = typeof m.content === 'string'
          ? m.content
          : JSON.stringify(m.content);
        const sender = m.senderInboxId === client.inboxId ? 'us' : m.senderInboxId?.substring(0, 12) + '...';
        const kind = m.kind !== undefined ? ` [kind:${m.kind}]` : '';
        const delivery = m.deliveryStatus !== undefined ? ` [delivery:${m.deliveryStatus}]` : '';
        console.log(`    ${sender}${kind}${delivery}: ${content?.substring(0, 100)}`);
      }
    } catch (e: any) {
      // Try without limit
      try {
        const msgs = await c.messages();
        console.log(`  Messages (no limit): ${msgs.length}`);
        for (const m of msgs.slice(-5)) {
          const content = typeof m.content === 'string'
            ? m.content
            : JSON.stringify(m.content);
          const sender = m.senderInboxId === client.inboxId ? 'us' : m.senderInboxId?.substring(0, 12) + '...';
          console.log(`    ${sender}: ${content?.substring(0, 100)}`);
        }
      } catch (e2: any) {
        console.log('  Messages error:', e2.message);
      }
    }
    console.log();
  }

  // Check V2 vs V3
  console.log('=== V2 vs V3 Notes ===');
  console.log('@xmtp/node-sdk is V3 (MLS) only.');
  console.log('V2 clients (older Coinbase Wallet) cannot see V3 messages.');
  console.log('Converse app should support V3.');
  console.log('To support V2, would need @xmtp/xmtp-js (deprecated) or a dual-send approach.');
}

main().catch(console.error);
