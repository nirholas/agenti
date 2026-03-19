/**
 * Copy Trading Skill - Standalone Solana wallet copy trading
 *
 * Commands:
 * /copy add <wallet> [options]   Follow a wallet
 * /copy remove <wallet|id>       Stop following
 * /copy list                     List followed wallets
 * /copy history [wallet]         View trade history
 * /copy pause <wallet|id>        Pause copying
 * /copy resume <wallet|id>       Resume copying
 * /copy stats                    View overall stats
 * /copy config <wallet|id>       Update config
 */

import type { CopyTrader, CopyTarget, CopyTradeConfig } from '../../../solana/copytrade';

let copyTrader: CopyTrader | null = null;

async function getCopyTrader(): Promise<CopyTrader> {
  if (!copyTrader) {
    const { getCopyTrader: getTrader } = await import('../../../solana/copytrade');
    copyTrader = getTrader();
  }
  return copyTrader;
}

function isConfigured(): boolean {
  return !!(process.env.SOLANA_PRIVATE_KEY || process.env.SOLANA_KEYPAIR_PATH);
}

function formatSol(sol: number): string {
  return sol.toFixed(4);
}

function formatPercent(decimal: number): string {
  return `${(decimal * 100).toFixed(1)}%`;
}

function parseOptions(args: string[]): {
  wallet?: string;
  name?: string;
  mult?: number;
  max?: number;
  min?: number;
  delay?: number;
  slippage?: number;
  buysOnly?: boolean;
  sellsOnly?: boolean;
} {
  const opts: ReturnType<typeof parseOptions> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if (!arg.startsWith('--') && !opts.wallet) {
      opts.wallet = arg;
      continue;
    }

    switch (arg) {
      case '--name':
        if (next) opts.name = next;
        i++;
        break;
      case '--mult':
      case '--multiplier': {
        const v = next != null ? parseFloat(next) : NaN;
        if (!isNaN(v) && v > 0) opts.mult = v;
        i++;
        break;
      }
      case '--max': {
        const v = next != null ? parseFloat(next) : NaN;
        if (!isNaN(v) && v > 0) opts.max = v;
        i++;
        break;
      }
      case '--min': {
        const v = next != null ? parseFloat(next) : NaN;
        if (!isNaN(v) && v >= 0) opts.min = v;
        i++;
        break;
      }
      case '--delay': {
        const v = next != null ? parseInt(next, 10) : NaN;
        if (!isNaN(v) && v >= 0) opts.delay = v;
        i++;
        break;
      }
      case '--slippage': {
        const v = next != null ? parseInt(next, 10) : NaN;
        if (!isNaN(v) && v >= 0) opts.slippage = v;
        i++;
        break;
      }
      case '--buys-only':
        opts.buysOnly = true;
        break;
      case '--sells-only':
        opts.sellsOnly = true;
        break;
    }
  }

  return opts;
}

function formatTarget(target: CopyTarget): string {
  const status = target.enabled ? '🟢' : '🔴';
  const name = target.name ? ` (${target.name})` : '';
  const addr = target.address.slice(0, 8) + '...' + target.address.slice(-4);

  let output = `${status} **${addr}**${name}\n`;
  output += `   Mult: ${target.config.multiplier}x | Max: ${formatSol(target.config.maxPositionSol)} SOL\n`;
  output += `   Trades: ${target.stats.totalTradesCopied} | Success: ${target.stats.successfulTrades}/${target.stats.totalTradesCopied}\n`;
  output += `   Spent: ${formatSol(target.stats.totalSolSpent)} | Received: ${formatSol(target.stats.totalSolReceived)}\n`;
  output += `   PnL: ${target.stats.pnlSol >= 0 ? '+' : ''}${formatSol(target.stats.pnlSol)} SOL`;

  if (target.stats.lastTradeAt) {
    const ago = Math.floor((Date.now() - target.stats.lastTradeAt) / 60000);
    output += ` | Last: ${ago}m ago`;
  }

  return output;
}

async function handleAdd(args: string[]): Promise<string> {
  if (args.length === 0) {
    return 'Usage: /copy add <wallet> [--name "label"] [--mult 1.0] [--max 0.5]';
  }

  const opts = parseOptions(args);
  if (!opts.wallet) {
    return 'Please provide a wallet address to follow.';
  }

  // Validate wallet address
  if (opts.wallet.length < 32 || opts.wallet.length > 44) {
    return 'Invalid wallet address. Must be a valid Solana address (32-44 characters).';
  }

  const trader = await getCopyTrader();

  const config: Partial<CopyTradeConfig> = {
    targetWallet: opts.wallet,
  };

  if (opts.mult !== undefined) config.multiplier = opts.mult;
  if (opts.max !== undefined) config.maxPositionSol = opts.max;
  if (opts.min !== undefined) config.minTradeSol = opts.min;
  if (opts.delay !== undefined) config.delayMs = opts.delay;
  if (opts.slippage !== undefined) config.slippageBps = opts.slippage;
  if (opts.buysOnly) {
    config.copyBuys = true;
    config.copySells = false;
  }
  if (opts.sellsOnly) {
    config.copyBuys = false;
    config.copySells = true;
  }

  try {
    const target = trader.addTarget(opts.wallet, config, opts.name);

    return `**Wallet Added**

${formatTarget(target)}

Now monitoring for trades. Configure with \`/copy config ${target.id}\``;
  } catch (error) {
    return `Failed to add wallet: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function handleRemove(args: string[]): Promise<string> {
  if (args.length === 0) {
    return 'Usage: /copy remove <wallet|id>';
  }

  const identifier = args[0];
  const trader = await getCopyTrader();

  // Try to find by ID first, then by address
  let target = trader.getTarget(identifier);
  if (!target) {
    target = trader.getTargetByAddress(identifier);
  }

  if (!target) {
    return `No wallet found matching: ${identifier}`;
  }

  const success = trader.removeTarget(target.id);
  if (success) {
    const name = target.name ? ` (${target.name})` : '';
    return `Removed wallet: ${target.address.slice(0, 8)}...${name}`;
  }

  return 'Failed to remove wallet.';
}

async function handleList(): Promise<string> {
  const trader = await getCopyTrader();
  const targets = trader.listTargets();

  if (targets.length === 0) {
    return `**No Wallets Being Followed**

Add a wallet with:
\`\`\`
/copy add <wallet_address> --name "label" --mult 1.0 --max 0.5
\`\`\``;
  }

  let output = `**Following ${targets.length} Wallet${targets.length > 1 ? 's' : ''}**\n\n`;

  for (const target of targets) {
    output += formatTarget(target) + '\n\n';
  }

  return output;
}

async function handleHistory(args: string[]): Promise<string> {
  const trader = await getCopyTrader();
  const identifier = args[0];

  let targetId: string | undefined;
  if (identifier) {
    const target = trader.getTarget(identifier) || trader.getTargetByAddress(identifier);
    targetId = target?.id;
  }

  const history = trader.getHistory(targetId, 20);

  if (history.length === 0) {
    return 'No trade history found.';
  }

  let output = '**Trade History**\n\n';

  for (const entry of history.slice().reverse()) {
    const status = entry.status === 'success' ? '✅' : entry.status === 'pending' ? '⏳' : '❌';
    const action = entry.action.toUpperCase();
    const mint = entry.mint.slice(0, 8) + '...';
    const time = new Date(entry.createdAt).toLocaleTimeString();

    output += `${status} ${time} | ${action} ${mint} | ${formatSol(entry.ourAmount)} SOL`;
    if (entry.ourTx) {
      output += ` | [tx](https://solscan.io/tx/${entry.ourTx})`;
    }
    if (entry.error) {
      output += ` | ${entry.error.slice(0, 30)}`;
    }
    output += '\n';
  }

  return output;
}

async function handlePause(args: string[]): Promise<string> {
  if (args.length === 0) {
    return 'Usage: /copy pause <wallet|id>';
  }

  const identifier = args[0];
  const trader = await getCopyTrader();

  let target = trader.getTarget(identifier);
  if (!target) {
    target = trader.getTargetByAddress(identifier);
  }

  if (!target) {
    return `No wallet found matching: ${identifier}`;
  }

  const success = trader.pauseTarget(target.id);
  if (success) {
    const name = target.name ? ` (${target.name})` : '';
    return `Paused copying: ${target.address.slice(0, 8)}...${name}`;
  }

  return 'Failed to pause wallet.';
}

async function handleResume(args: string[]): Promise<string> {
  if (args.length === 0) {
    return 'Usage: /copy resume <wallet|id>';
  }

  const identifier = args[0];
  const trader = await getCopyTrader();

  let target = trader.getTarget(identifier);
  if (!target) {
    target = trader.getTargetByAddress(identifier);
  }

  if (!target) {
    return `No wallet found matching: ${identifier}`;
  }

  const success = trader.resumeTarget(target.id);
  if (success) {
    const name = target.name ? ` (${target.name})` : '';
    return `Resumed copying: ${target.address.slice(0, 8)}...${name}`;
  }

  return 'Failed to resume wallet.';
}

async function handleStats(): Promise<string> {
  const trader = await getCopyTrader();
  const stats = trader.getStats();

  return `**Copy Trading Stats**

Wallets: ${stats.activeTargets}/${stats.totalTargets} active
Trades Copied: ${stats.totalTradesCopied}
Success Rate: ${formatPercent(stats.successRate)}
Total PnL: ${stats.totalPnlSol >= 0 ? '+' : ''}${formatSol(stats.totalPnlSol)} SOL`;
}

async function handleConfig(args: string[]): Promise<string> {
  if (args.length === 0) {
    return `Usage: /copy config <wallet|id> [options]

Options:
  --mult <number>     Position multiplier
  --max <sol>         Max SOL per trade
  --min <sol>         Min trade to copy
  --delay <ms>        Delay before copying
  --slippage <bps>    Slippage tolerance
  --buys-only         Only copy buys
  --sells-only        Only copy sells`;
  }

  const opts = parseOptions(args);
  if (!opts.wallet) {
    return 'Please provide a wallet address or ID.';
  }

  const trader = await getCopyTrader();

  let target = trader.getTarget(opts.wallet);
  if (!target) {
    target = trader.getTargetByAddress(opts.wallet);
  }

  if (!target) {
    return `No wallet found matching: ${opts.wallet}`;
  }

  const config: Partial<CopyTradeConfig> = {};

  if (opts.mult !== undefined) config.multiplier = opts.mult;
  if (opts.max !== undefined) config.maxPositionSol = opts.max;
  if (opts.min !== undefined) config.minTradeSol = opts.min;
  if (opts.delay !== undefined) config.delayMs = opts.delay;
  if (opts.slippage !== undefined) config.slippageBps = opts.slippage;
  if (opts.buysOnly) {
    config.copyBuys = true;
    config.copySells = false;
  }
  if (opts.sellsOnly) {
    config.copyBuys = false;
    config.copySells = true;
  }

  if (Object.keys(config).length === 0) {
    return `**Current Config for ${target.name || target.address.slice(0, 8)}...**

Multiplier: ${target.config.multiplier}x
Max per trade: ${formatSol(target.config.maxPositionSol)} SOL
Min to copy: ${formatSol(target.config.minTradeSol)} SOL
Delay: ${target.config.delayMs ?? 0}ms
Slippage: ${target.config.slippageBps || 500} bps
Copy buys: ${target.config.copyBuys}
Copy sells: ${target.config.copySells}`;
  }

  const success = trader.updateTargetConfig(target.id, config);
  if (success) {
    return `Config updated for ${target.name || target.address.slice(0, 8)}...`;
  }

  return 'Failed to update config.';
}

export async function execute(args: string): Promise<string> {
  if (!isConfigured()) {
    return 'Copy trading not configured. Set SOLANA_PRIVATE_KEY environment variable.';
  }

  const parts = args.trim().split(/\s+/);
  const command = parts[0]?.toLowerCase() || 'help';
  const rest = parts.slice(1);

  switch (command) {
    case 'add':
      return handleAdd(rest);

    case 'remove':
    case 'rm':
    case 'delete':
      return handleRemove(rest);

    case 'list':
    case 'ls':
      return handleList();

    case 'history':
    case 'hist':
      return handleHistory(rest);

    case 'pause':
    case 'stop':
      return handlePause(rest);

    case 'resume':
    case 'start':
      return handleResume(rest);

    case 'stats':
      return handleStats();

    case 'config':
    case 'cfg':
    case 'settings':
      return handleConfig(rest);

    case 'help':
    default:
      return `**Copy Trading - Solana**

Monitor wallets and automatically mirror their trades.

**Commands:**
\`\`\`
/copy add <wallet> [options]   Follow a wallet
/copy remove <wallet|id>       Stop following
/copy list                     List followed wallets
/copy history [wallet]         View trade history
/copy pause <wallet|id>        Pause copying
/copy resume <wallet|id>       Resume copying
/copy stats                    View overall stats
/copy config <wallet|id>       View/update config
\`\`\`

**Options for add/config:**
  --name "label"    Friendly name
  --mult 1.0        Position multiplier
  --max 0.5         Max SOL per trade
  --delay 0         Delay before copying (ms)
  --buys-only       Only copy buys
  --sells-only      Only copy sells

**Example:**
\`\`\`
/copy add 7xKXtg... --name "whale" --mult 0.5 --max 0.1
\`\`\``;
  }
}

export default {
  name: 'copy-trading-solana',
  description: 'Copy Trading - Monitor and mirror Solana wallet trades automatically',
  commands: ['/copy-sol', '/copysol'],
  handle: execute,
};
