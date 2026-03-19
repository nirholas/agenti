import { Command } from 'commander';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { ANET_HOME, config } from '../config.js';
import { SettingsManager } from '../settings/manager.js';
import { generateWallet, saveWallet, walletFromPrivateKey } from '../core/wallet/index.js';

export function registerInitCommand(program: Command) {
  program
    .command('init')
    .description('Initialize a new agent — wallet is your identity')
    .option('--private-key <key>', 'Import existing private key')
    .option('--gen', 'Generate a new wallet keypair')
    .option('--name <name>', 'Agent name', 'my-agent')
    .option('--network <net>', 'Network: testnet or mainnet', 'testnet')
    .option('--force', 'Overwrite existing wallet (dangerous!)')
    .action(async (opts) => {
      // If no wallet flag provided and no existing wallet, show guidance
      const walletPath = path.join(ANET_HOME, 'wallet.json');
      if (!opts.privateKey && !opts.gen && !fs.existsSync(walletPath)) {
        console.log('Initialize your agent with a wallet:\n');
        console.log('  anet init --gen                    Generate a fresh keypair');
        console.log('  anet init --private-key 0xabc...   Import an existing key\n');
        return;
      }

      // Protect existing wallet from accidental overwrite
      if ((opts.privateKey || opts.gen) && fs.existsSync(walletPath) && !opts.force) {
        console.error('A wallet already exists at ' + walletPath);
        console.error('Running init again would destroy your existing private key.\n');
        console.error('If you really want to overwrite it, use: anet init --gen --force');
        return;
      }

      console.log('Initializing anet agent...\n');

      // Create ~/.anet/ directory structure
      fs.mkdirSync(ANET_HOME, { recursive: true });
      fs.mkdirSync(path.join(ANET_HOME, 'xmtp'), { recursive: true });

      // Write default config and hooks
      SettingsManager.initDefaults(ANET_HOME);
      const settings = new SettingsManager();
      settings.set('agent.name', opts.name);
      settings.set('network', opts.network);
      console.log(`  Config:  ${path.join(ANET_HOME, 'config.yaml')}`);
      console.log(`  Hooks:   ${path.join(ANET_HOME, 'hooks.yaml')}`);

      // Resolve wallet mode: --private-key, --gen, or existing
      const walletPassword = `anet-${crypto.randomBytes(8).toString('hex')}`;
      let walletAddress = '';
      let privateKey = '';

      if (opts.privateKey) {
        // Import existing key
        const wallet = walletFromPrivateKey(opts.privateKey);
        walletAddress = wallet.address;
        privateKey = opts.privateKey;
        const walletData = {
          address: wallet.address,
          privateKey: opts.privateKey,
          createdAt: new Date().toISOString(),
        };
        saveWallet(walletData, walletPath, walletPassword);
        console.log(`\n  Wallet imported: ${wallet.address}`);
      } else if (opts.gen) {
        // Generate new key — securely stored, AES-256-GCM encrypted
        const walletData = generateWallet();
        walletAddress = walletData.address;
        privateKey = walletData.privateKey;
        saveWallet(walletData, walletPath, walletPassword);
        console.log(`\n  Wallet generated: ${walletData.address}`);
        console.log(`  Encrypted with AES-256-GCM at: ${walletPath}`);
        console.log(`  File permissions: 0600 (owner-only read/write)`);
      } else {
        console.log(`\n  Wallet exists: ${walletPath}`);
      }

      // Write .env with private key and password
      const envPath = path.join(ANET_HOME, '.env');
      const envLines = [
        `NETWORK=${opts.network}`,
        `WALLET_PASSWORD=${walletPassword}`,
      ];
      if (privateKey) {
        envLines.unshift(`PRIVATE_KEY=${privateKey}`);
      }
      fs.writeFileSync(envPath, envLines.join('\n') + '\n', { mode: 0o600 });
      console.log(`  Env:     ${envPath} (mode 0600)`);

      console.log(`\nAgent initialized at ${ANET_HOME}`);
      if (walletAddress) {
        console.log(`\nYour wallet: ${walletAddress}`);
        console.log('\nNext steps:');
        console.log("  1. anet skills add my-skill --description 'Does something useful'");
        console.log('  2. anet up');
        console.log(`  3. Fund ${walletAddress} with ETH for on-chain registration`);
      }
    });
}
