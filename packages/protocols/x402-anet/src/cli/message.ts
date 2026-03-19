import { Command } from 'commander';
import { loadContext, getIndexer, getProvider } from './context.js';
import { AgentMessagingClient } from '../core/messaging/client.js';
import { config } from '../config.js';
import path from 'path';

export function registerMessageCommand(program: Command) {
  const cmd = program
    .command('message')
    .description('Send and receive XMTP messages (end-to-end encrypted)')
    .action(() => {
      cmd.outputHelp();
    });

  cmd
    .command('send <target> <text>')
    .description('Send a DM via XMTP (target: agent-id, 0x address, or ENS name)')
    .action(async (target: string, text: string) => {
      const ctx = loadContext(true);
      let targetAddress: string;
      let label: string;

      if (/^\d+$/.test(target)) {
        // Numeric agent ID — resolve from index
        const indexer = getIndexer();
        const agent = indexer.getAgent(parseInt(target));
        indexer.close();

        targetAddress = agent?.xmtp_address || agent?.wallet_address || '';
        if (!targetAddress) {
          console.error(`Agent ${target} not found or no address. Try: anet sync`);
          return;
        }
        label = `agent ${target} (${agent?.name || 'Unknown'})`;
      } else if (target.startsWith('0x')) {
        // Raw Ethereum address — validate format
        if (!/^0x[0-9a-fA-F]{40}$/.test(target)) {
          console.error(`Invalid Ethereum address: "${target}"`);
          console.error('  Expected format: 0x followed by 40 hex characters (e.g. 0xAbC...123)');
          return;
        }
        targetAddress = target;
        label = target;
      } else if (target.includes('.')) {
        // ENS/Basename — resolve to address
        console.log(`Resolving ${target}...`);
        try {
          const { ethers } = await import('ethers');
          // All ENS names (including .base.eth via CCIP-read) resolve through Ethereum mainnet
          const resolver = new ethers.JsonRpcProvider('https://eth.llamarpc.com');
          const resolved = await resolver.resolveName(target);
          if (!resolved) {
            console.error(`Could not resolve ${target}`);
            return;
          }
          targetAddress = resolved;
          label = `${target} (${resolved})`;
        } catch (e: any) {
          console.error(`Name resolution failed: ${e.message}`);
          return;
        }
      } else {
        console.error('Target must be an agent ID, 0x address, or ENS name.');
        return;
      }

      console.log(`Sending to ${label}...`);

      const messaging = new AgentMessagingClient(ctx.wallet!.privateKey, {
        env: config.xmtpEnv,
        encryptionKey: config.xmtpEncryptionKey,
        dbPath: path.join(config.home, 'xmtp'),
      });

      try {
        await messaging.start();
        const msgId = await messaging.sendMessage(targetAddress, text);
        if (msgId) {
          console.log('Message sent.');
        } else {
          console.log('Could not deliver — recipient not on XMTP.');
        }
      } catch (e: any) {
        console.error(`Failed: ${e.message}`);
      } finally {
        await messaging.stop();
      }
    });

  cmd
    .command('inbox')
    .description('List recent XMTP conversations')
    .option('--limit <n>', 'Max conversations to show', parseInt)
    .action(async (opts: any) => {
      const ctx = loadContext(true);
      const limit = opts.limit || 20;

      const messaging = new AgentMessagingClient(ctx.wallet!.privateKey, {
        env: config.xmtpEnv,
        encryptionKey: config.xmtpEncryptionKey,
        dbPath: path.join(config.home, 'xmtp'),
      });

      try {
        await messaging.start();
        const conversations = await messaging.getConversations();

        if (conversations.length === 0) {
          console.log('No conversations yet.');
          return;
        }

        const shown = conversations.slice(0, limit);
        console.log(`Inbox (${shown.length} of ${conversations.length} conversations):\n`);

        for (const conv of shown) {
          try {
            // Get conversation members
            const members = await conv.members();
            const peerAddresses = members
              .filter((m: any) => {
                // Filter out self by comparing account addresses
                const addrs = m.accountAddresses || [];
                return !addrs.some((a: string) =>
                  a.toLowerCase() === messaging.getAddress().toLowerCase()
                );
              })
              .flatMap((m: any) => m.accountAddresses || [])
              .map((a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`);

            // Get last message (try BigInt first, fall back to number)
            let messages: any[] = [];
            try {
              messages = await conv.messages({ limit: BigInt(1) });
            } catch {
              try { messages = await conv.messages({ limit: 1 }); } catch {}
            }
            let preview = '(no messages)';
            if (messages.length > 0) {
              const msg = messages[0];
              const content = typeof msg.content === 'string'
                ? msg.content
                : JSON.stringify(msg.content);
              preview = content.length > 60 ? content.slice(0, 57) + '...' : content;
            }

            const peer = peerAddresses.length > 0 ? peerAddresses.join(', ') : 'unknown';
            console.log(`  ${peer}`);
            console.log(`    ${preview}\n`);
          } catch {
            console.log(`  (conversation unreadable)\n`);
          }
        }
      } catch (e: any) {
        console.error(`Failed: ${e.message}`);
      } finally {
        await messaging.stop();
      }
    });

  cmd
    .command('listen')
    .description('Stream incoming XMTP messages')
    .option('--webhook <url>', 'Forward messages to webhook URL')
    .action(async (opts: any) => {
      const ctx = loadContext(true);

      console.log('Listening for messages...');
      console.log('Press Ctrl+C to stop\n');

      const messaging = new AgentMessagingClient(ctx.wallet!.privateKey, {
        env: config.xmtpEnv,
        encryptionKey: config.xmtpEncryptionKey,
        dbPath: path.join(config.home, 'xmtp'),
      });

      // Register a display handler
      messaging.registerService('*', async (sender, payload) => {
        const timestamp = new Date().toISOString().substring(11, 19);
        console.log(`[${timestamp}] ${sender}: ${JSON.stringify(payload)}`);

        if (opts.webhook) {
          try {
            await fetch(opts.webhook, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sender, payload, timestamp }),
            });
          } catch (e: any) {
            console.error(`Webhook failed: ${e.message}`);
          }
        }

        return { status: 'received' };
      });

      try {
        await messaging.start();
        await messaging.startListening();
      } catch (e: any) {
        console.error(`XMTP failed: ${e.message}`);
        return;
      }

      // Keep alive
      await new Promise(() => {});
    });
}
