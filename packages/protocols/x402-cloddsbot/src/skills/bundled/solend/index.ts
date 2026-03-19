/**
 * Solend CLI Skill — Solana Lending & Borrowing (10 Commands)
 *
 * /solend deposit <amount> <token>       - Deposit collateral
 * /solend withdraw <amount|all> <token>  - Withdraw collateral
 * /solend borrow <amount> <token>        - Borrow assets
 * /solend repay <amount|all> <token>     - Repay borrowed assets
 * /solend obligation                     - View your positions
 * /solend health                         - Check health factor
 * /solend reserves                       - List reserves
 * /solend rates                          - View supply/borrow rates
 * /solend markets                        - List lending markets
 * /solend help                           - Show this help
 */

import { formatHelp } from '../../help';
import { wrapSkillError } from '../../errors';

const getSolanaModules = async () => {
  const [wallet, solend, tokenlist] = await Promise.all([
    import('../../../solana/wallet'),
    import('../../../solana/solend'),
    import('../../../solana/tokenlist'),
  ]);
  return { wallet, solend, tokenlist };
};

function isConfigured(): boolean {
  return !!(process.env.SOLANA_PRIVATE_KEY || process.env.SOLANA_KEYPAIR_PATH);
}

// ============================================
// HANDLERS
// ============================================

async function handleDeposit(args: string[]): Promise<string> {
  if (!isConfigured()) {
    return 'Solend not configured. Set SOLANA_PRIVATE_KEY.';
  }

  if (args.length < 2) {
    return 'Usage: /solend deposit <amount> <token>';
  }

  const amount = args[0];
  const token = args.slice(1).join(' ');

  try {
    const { wallet, solend, tokenlist } = await getSolanaModules();
    const keypair = wallet.loadSolanaKeypair();
    const connection = wallet.getSolanaConnection();

    const [mint] = await tokenlist.resolveTokenMints([token]);
    if (!mint) {
      return `Token not found: ${token}`;
    }

    const tokens = await tokenlist.getTokenList();
    const tokenInfo = tokens.find(t => t.address === mint);
    const decimals = tokenInfo?.decimals ?? 6;
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) return `Invalid amount: ${amount}`;
    const amountLamports = (parsed * Math.pow(10, decimals)).toString();

    const result = await solend.solendDeposit(connection, keypair, {
      reserveMint: mint,
      amount: amountLamports,
    });

    return `**Solend Deposit**\n\n` +
      `Deposited: ${amount} ${result.symbol || token}\n` +
      `TX: \`${result.signature}\``;
  } catch (error) {
    return wrapSkillError('Solend', 'deposit', error);
  }
}

async function handleWithdraw(args: string[]): Promise<string> {
  if (!isConfigured()) {
    return 'Solend not configured. Set SOLANA_PRIVATE_KEY.';
  }

  if (args.length < 2) {
    return 'Usage: /solend withdraw <amount|all> <token>';
  }

  const amount = args[0];
  const token = args.slice(1).join(' ');
  const withdrawAll = amount.toLowerCase() === 'all';

  try {
    const { wallet, solend, tokenlist } = await getSolanaModules();
    const keypair = wallet.loadSolanaKeypair();
    const connection = wallet.getSolanaConnection();

    const [mint] = await tokenlist.resolveTokenMints([token]);
    if (!mint) {
      return `Token not found: ${token}`;
    }

    const tokens = await tokenlist.getTokenList();
    const tokenInfo = tokens.find(t => t.address === mint);
    const decimals = tokenInfo?.decimals ?? 6;
    const parsed = withdrawAll ? 0 : parseFloat(amount);
    if (!withdrawAll && (isNaN(parsed) || parsed <= 0)) return `Invalid amount: ${amount}`;
    const amountLamports = withdrawAll ? '0' : (parsed * Math.pow(10, decimals)).toString();

    const result = await solend.solendWithdraw(connection, keypair, {
      reserveMint: mint,
      amount: amountLamports,
      withdrawAll,
    });

    return `**Solend Withdraw**\n\n` +
      `Withdrew: ${withdrawAll ? 'ALL' : amount} ${result.symbol || token}\n` +
      `TX: \`${result.signature}\``;
  } catch (error) {
    return wrapSkillError('Solend', 'withdraw', error);
  }
}

async function handleBorrow(args: string[]): Promise<string> {
  if (!isConfigured()) {
    return 'Solend not configured. Set SOLANA_PRIVATE_KEY.';
  }

  if (args.length < 2) {
    return 'Usage: /solend borrow <amount> <token>';
  }

  const amount = args[0];
  const token = args.slice(1).join(' ');

  try {
    const { wallet, solend, tokenlist } = await getSolanaModules();
    const keypair = wallet.loadSolanaKeypair();
    const connection = wallet.getSolanaConnection();

    const [mint] = await tokenlist.resolveTokenMints([token]);
    if (!mint) {
      return `Token not found: ${token}`;
    }

    const tokens = await tokenlist.getTokenList();
    const tokenInfo = tokens.find(t => t.address === mint);
    const decimals = tokenInfo?.decimals ?? 6;
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) return `Invalid amount: ${amount}`;
    const amountLamports = (parsed * Math.pow(10, decimals)).toString();

    const result = await solend.solendBorrow(connection, keypair, {
      reserveMint: mint,
      amount: amountLamports,
    });

    return `**Solend Borrow**\n\n` +
      `Borrowed: ${amount} ${result.symbol || token}\n` +
      `TX: \`${result.signature}\``;
  } catch (error) {
    return wrapSkillError('Solend', 'borrow', error);
  }
}

async function handleRepay(args: string[]): Promise<string> {
  if (!isConfigured()) {
    return 'Solend not configured. Set SOLANA_PRIVATE_KEY.';
  }

  if (args.length < 2) {
    return 'Usage: /solend repay <amount|all> <token>';
  }

  const amount = args[0];
  const token = args.slice(1).join(' ');
  const repayAll = amount.toLowerCase() === 'all';

  try {
    const { wallet, solend, tokenlist } = await getSolanaModules();
    const keypair = wallet.loadSolanaKeypair();
    const connection = wallet.getSolanaConnection();

    const [mint] = await tokenlist.resolveTokenMints([token]);
    if (!mint) {
      return `Token not found: ${token}`;
    }

    const tokens = await tokenlist.getTokenList();
    const tokenInfo = tokens.find(t => t.address === mint);
    const decimals = tokenInfo?.decimals ?? 6;
    const parsed = repayAll ? 0 : parseFloat(amount);
    if (!repayAll && (isNaN(parsed) || parsed <= 0)) return `Invalid amount: ${amount}`;
    const amountLamports = repayAll ? '0' : (parsed * Math.pow(10, decimals)).toString();

    const result = await solend.solendRepay(connection, keypair, {
      reserveMint: mint,
      amount: amountLamports,
      repayAll,
    });

    return `**Solend Repay**\n\n` +
      `Repaid: ${repayAll ? 'ALL' : amount} ${result.symbol || token}\n` +
      `TX: \`${result.signature}\``;
  } catch (error) {
    return wrapSkillError('Solend', 'repay', error);
  }
}

async function handleObligation(): Promise<string> {
  if (!isConfigured()) {
    return 'Solend not configured. Set SOLANA_PRIVATE_KEY.';
  }

  try {
    const { wallet, solend } = await getSolanaModules();
    const keypair = wallet.loadSolanaKeypair();
    const connection = wallet.getSolanaConnection();

    const obligation = await solend.getSolendObligation(connection, keypair);

    if (!obligation) {
      return 'No active Solend position found.';
    }

    let output = `**Solend Position**\n\n`;
    output += `Address: \`${obligation.address}\`\n`;
    output += `Health Factor: **${obligation.healthFactor === Infinity ? '∞' : obligation.healthFactor.toFixed(2)}**\n`;
    output += `LTV: ${obligation.ltv.toFixed(1)}%\n\n`;

    if (obligation.deposits.length > 0) {
      output += `**Deposits** ($${(parseFloat(obligation.totalDepositValue) || 0).toFixed(2)})\n`;
      for (const dep of obligation.deposits) {
        output += `  ${dep.symbol}: ${dep.amount} ($${(parseFloat(dep.amountUsd) || 0).toFixed(2)})\n`;
      }
      output += '\n';
    }

    if (obligation.borrows.length > 0) {
      output += `**Borrows** ($${(parseFloat(obligation.totalBorrowValue) || 0).toFixed(2)})\n`;
      for (const bor of obligation.borrows) {
        output += `  ${bor.symbol}: ${bor.amount} ($${(parseFloat(bor.amountUsd) || 0).toFixed(2)})\n`;
      }
    }

    return output;
  } catch (error) {
    return wrapSkillError('Solend', 'obligation', error);
  }
}

async function handleHealth(): Promise<string> {
  if (!isConfigured()) {
    return 'Solend not configured. Set SOLANA_PRIVATE_KEY.';
  }

  try {
    const { wallet, solend } = await getSolanaModules();
    const keypair = wallet.loadSolanaKeypair();
    const connection = wallet.getSolanaConnection();

    const obligation = await solend.getSolendHealth(connection, keypair);

    if (!obligation) {
      return 'No active Solend position found.';
    }

    const hf = obligation.healthFactor;
    let riskLevel = 'SAFE';
    if (hf < 1.1) riskLevel = 'CRITICAL';
    else if (hf < 1.25) riskLevel = 'HIGH';
    else if (hf < 1.5) riskLevel = 'MEDIUM';
    else if (hf < 2) riskLevel = 'LOW';

    return `**Solend Health Check**\n\n` +
      `Health Factor: **${hf === Infinity ? '∞' : hf.toFixed(2)}**\n` +
      `Risk Level: **${riskLevel}**\n` +
      `LTV: ${obligation.ltv.toFixed(1)}%\n` +
      `Borrow Limit: $${(parseFloat(obligation.borrowLimit) || 0).toFixed(2)}\n` +
      `Liquidation Threshold: $${(parseFloat(obligation.liquidationThreshold) || 0).toFixed(2)}\n\n` +
      `Total Deposits: $${(parseFloat(obligation.totalDepositValue) || 0).toFixed(2)}\n` +
      `Total Borrows: $${(parseFloat(obligation.totalBorrowValue) || 0).toFixed(2)}`;
  } catch (error) {
    return wrapSkillError('Solend', 'health check', error);
  }
}

async function handleReserves(): Promise<string> {
  try {
    const { wallet, solend } = await getSolanaModules();
    const connection = wallet.getSolanaConnection();

    const reserves = await solend.getSolendReserves(connection);

    if (reserves.length === 0) {
      return 'No reserves found.';
    }

    let output = `**Solend Reserves** (${reserves.length})\n\n`;

    for (const res of reserves.slice(0, 15)) {
      output += `**${res.symbol}**\n`;
      output += `  Supply APY: ${res.depositRate.toFixed(2)}% | Borrow APY: ${res.borrowRate.toFixed(2)}%\n`;
      output += `  Utilization: ${res.utilizationRate.toFixed(1)}% | LTV: ${res.ltv.toFixed(0)}%\n`;
    }

    if (reserves.length > 15) {
      output += `\n... and ${reserves.length - 15} more`;
    }

    return output;
  } catch (error) {
    return wrapSkillError('Solend', 'reserves', error);
  }
}

async function handleRates(): Promise<string> {
  try {
    const { wallet, solend } = await getSolanaModules();
    const connection = wallet.getSolanaConnection();

    const reserves = await solend.getSolendReserves(connection);

    if (reserves.length === 0) {
      return 'No reserves found.';
    }

    let output = `**Solend Interest Rates**\n\n`;
    output += `| Token | Supply APY | Borrow APY | Util |\n`;
    output += `|-------|------------|------------|------|\n`;

    for (const res of reserves.slice(0, 20)) {
      output += `| ${res.symbol.padEnd(5)} | ${res.depositRate.toFixed(2).padStart(9)}% | ${res.borrowRate.toFixed(2).padStart(9)}% | ${res.utilizationRate.toFixed(0).padStart(3)}% |\n`;
    }

    return output;
  } catch (error) {
    return wrapSkillError('Solend', 'rates', error);
  }
}

async function handleMarkets(): Promise<string> {
  return `**Solend Lending Markets**\n\n` +
    `**Main Pool**\n` +
    `Address: \`DdZR6zRFiUt4S5mg7AV1uKB2z1116sp1ObwbKhmYwjGh\`\n` +
    `Use /solend reserves to see all assets in this pool.\n\n` +
    `Solend also supports isolated pools for specific asset pairs.\n` +
    `Visit https://solend.fi for the full list.`;
}

// ============================================
// MAIN HANDLER
// ============================================

export async function execute(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const command = parts[0]?.toLowerCase() || 'help';
  const rest = parts.slice(1);

  switch (command) {
    case 'deposit':
      return handleDeposit(rest);
    case 'withdraw':
      return handleWithdraw(rest);
    case 'borrow':
      return handleBorrow(rest);
    case 'repay':
      return handleRepay(rest);
    case 'obligation':
    case 'position':
    case 'pos':
      return handleObligation();
    case 'health':
      return handleHealth();
    case 'reserves':
      return handleReserves();
    case 'rates':
      return handleRates();
    case 'markets':
    case 'pools':
      return handleMarkets();

    case 'help':
    default:
      return formatHelp({
        name: 'Solend',
        emoji: '💰',
        description: 'Solana lending and borrowing on Solend',
        sections: [
          {
            title: 'Lending',
            commands: [
              { cmd: '/solend deposit <amount> <token>', description: 'Deposit collateral' },
              { cmd: '/solend withdraw <amount|all> <token>', description: 'Withdraw collateral' },
              { cmd: '/solend borrow <amount> <token>', description: 'Borrow assets' },
              { cmd: '/solend repay <amount|all> <token>', description: 'Repay borrowed assets' },
              { cmd: '/solend obligation', description: 'View your positions' },
              { cmd: '/solend health', description: 'Check health factor' },
            ],
          },
          {
            title: 'Info',
            commands: [
              { cmd: '/solend reserves', description: 'List available reserves' },
              { cmd: '/solend rates', description: 'View supply/borrow rates' },
              { cmd: '/solend markets', description: 'List lending markets' },
            ],
          },
        ],
        examples: [
          '/solend deposit 100 USDC',
          '/solend borrow 50 SOL',
          '/solend health',
          '/solend rates',
        ],
        seeAlso: [
          { cmd: '/kamino', description: 'Kamino Finance lending' },
          { cmd: '/marginfi', description: 'MarginFi lending' },
          { cmd: '/jup', description: 'Jupiter aggregator' },
          { cmd: '/bags', description: 'Wallet balances' },
        ],
      });
  }
}

export default {
  name: 'solend',
  description: 'Solend - Solana lending and borrowing',
  commands: ['/solend'],
  handle: execute,
};
