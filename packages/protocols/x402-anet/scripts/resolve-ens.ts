import { ethers } from 'ethers';

const name = process.argv[2] || 'lincoln2.base.eth';
const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
const addr = await provider.resolveName(name);
console.log(`${name} => ${addr}`);

// Also check if this address is on XMTP
if (addr) {
  const { Client } = await import('@xmtp/node-sdk');
  const { config } = await import('../src/config.js');
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

  const fs = await import('fs');
  const path = await import('path');
  const crypto = await import('crypto');
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

  const identifier = { identifier: addr.toLowerCase(), identifierKind: 0 as const };
  const canMsg = await client.canMessage([identifier]);

  console.log(`\nXMTP reachability (production):`);
  for (const [key, value] of canMsg.entries()) {
    console.log(`  ${key} => ${value}`);
  }
}
