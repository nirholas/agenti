/**
 * MarginFi CLI Skill — Solana Lending & Borrowing (10 Commands)
 *
 * /marginfi deposit <amount> <token>       - Deposit collateral
 * /marginfi withdraw <amount|all> <token>  - Withdraw collateral
 * /marginfi borrow <amount> <token>        - Borrow assets
 * /marginfi repay <amount|all> <token>     - Repay borrowed assets
 * /marginfi account                        - View your positions
 * /marginfi health                         - Check health factor
 * /marginfi banks                          - List all lending pools
 * /marginfi rates                          - View supply/borrow rates
 * /marginfi help                           - Show this help
 */

import { formatHelp } from '../../help';
import { wrapSkillError } from '../../errors';

const getSolanaModules = async () => {
  const [wallet, marginfi, tokenlist] = await Promise.all([
    import('../../../solana/wallet'),
    import('../../../solana/marginfi'),
    import('../../../solana/tokenlist'),
  ]);
  return { wallet, marginfi, tokenlist };
};

function isConfigured(): boolean {
  return !!(process.env.SOLANA_PRIVATE_KEY || process.env.SOLANA_KEYPAIR_PATH);
}

// ============================================
// HANDLERS
// ============================================

async function handleDeposit(args: string[]): Promise<string> {
  if (!isConfigured()) {
    return 'MarginFi not configured. Set SOLANA_PRIVATE_KEY.';
  }

  if (args.length < 2) {
    return 'Usage: /marginfi deposit <amount> <token>';
  }

  const amount = args[0];
  const token = args.slice(1).join(' ');

  try {
    const { wallet, marginfi, tokenlist } = await getSolanaModules();
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

    const result = await marginfi.marginfiDeposit(connection, keypair, {
      bankMint: mint,
      amount: amountLamports,
    });

    return `**MarginFi Deposit**\n\n` +
      `Deposited: ${amount} ${result.symbol || token}\n` +
      `TX: \`${result.signature}\``;
  } catch (error) {
    return wrapSkillError('MarginFi', 'deposit', error);
  }
}

async function handleWithdraw(args: string[]): Promise<string> {
  if (!isConfigured()) {
    return 'MarginFi not configured. Set SOLANA_PRIVATE_KEY.';
  }

  if (args.length < 2) {
    return 'Usage: /marginfi withdraw <amount|all> <token>';
  }

  const amount = args[0];
  const token = args.slice(1).join(' ');
  const withdrawAll = amount.toLowerCase() === 'all';

  try {
    const { wallet, marginfi, tokenlist } = await getSolanaModules();
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

    const result = await marginfi.marginfiWithdraw(connection, keypair, {
      bankMint: mint,
      amount: amountLamports,
      withdrawAll,
    });

    return `**MarginFi Withdraw**\n\n` +
      `Withdrew: ${withdrawAll ? 'ALL' : amount} ${result.symbol || token}\n` +
      `TX: \`${result.signature}\``;
  } catch (error) {
    return wrapSkillError('MarginFi', 'withdraw', error);
  }
}

async function handleBorrow(args: string[]): Promise<string> {
  if (!isConfigured()) {
    return 'MarginFi not configured. Set SOLANA_PRIVATE_KEY.';
  }

  if (args.length < 2) {
    return 'Usage: /marginfi borrow <amount> <token>';
  }

  const amount = args[0];
  const token = args.slice(1).join(' ');

  try {
    const { wallet, marginfi, tokenlist } = await getSolanaModules();
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

    const result = await marginfi.marginfiBorrow(connection, keypair, {
      bankMint: mint,
      amount: amountLamports,
    });

    return `**MarginFi Borrow**\n\n` +
      `Borrowed: ${amount} ${result.symbol || token}\n` +
      `TX: \`${result.signature}\``;
  } catch (error) {
    return wrapSkillError('MarginFi', 'borrow', error);
  }
}

async function handleRepay(args: string[]): Promise<string> {
  if (!isConfigured()) {
    return 'MarginFi not configured. Set SOLANA_PRIVATE_KEY.';
  }

  if (args.length < 2) {
    return 'Usage: /marginfi repay <amount|all> <token>';
  }

  const amount = args[0];
  const token = args.slice(1).join(' ');
  const repayAll = amount.toLowerCase() === 'all';

  try {
    const { wallet, marginfi, tokenlist } = await getSolanaModules();
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

    const result = await marginfi.marginfiRepay(connection, keypair, {
      bankMint: mint,
      amount: amountLamports,
      repayAll,
    });

    return `**MarginFi Repay**\n\n` +
      `Repaid: ${repayAll ? 'ALL' : amount} ${result.symbol || token}\n` +
      `TX: \`${result.signature}\``;
  } catch (error) {
    return wrapSkillError('MarginFi', 'repay', error);
  }
}

async function handleAccount(): Promise<string> {
  if (!isConfigured()) {
    return 'MarginFi not configured. Set SOLANA_PRIVATE_KEY.';
  }

  try {
    const { wallet, marginfi } = await getSolanaModules();
    const keypair = wallet.loadSolanaKeypair();
    const connection = wallet.getSolanaConnection();

    const account = await marginfi.getMarginfiAccount(connection, keypair);

    if (!account) {
      return 'No active MarginFi account found.';
    }

    let output = `**MarginFi Account**\n\n`;
    output += `Address: \`${account.address}\`\n`;
    output += `Health Factor: **${account.healthFactor === Infinity ? '∞' : account.healthFactor.toFixed(2)}**\n`;
    output += `LTV: ${account.ltv.toFixed(1)}%\n\n`;

    if (account.deposits.length > 0) {
      output += `**Deposits** ($${(parseFloat(account.totalDepositValue) || 0).toFixed(2)})\n`;
      for (const dep of account.deposits) {
        output += `  ${dep.symbol}: ${dep.amount} ($${(parseFloat(dep.amountUsd) || 0).toFixed(2)})\n`;
      }
      output += '\n';
    }

    if (account.borrows.length > 0) {
      output += `**Borrows** ($${(parseFloat(account.totalBorrowValue) || 0).toFixed(2)})\n`;
      for (const bor of account.borrows) {
        output += `  ${bor.symbol}: ${bor.amount} ($${(parseFloat(bor.amountUsd) || 0).toFixed(2)})\n`;
      }
    }

    return output;
  } catch (error) {
    return wrapSkillError('MarginFi', 'account', error);
  }
}

async function handleHealth(): Promise<string> {
  if (!isConfigured()) {
    return 'MarginFi not configured. Set SOLANA_PRIVATE_KEY.';
  }

  try {
    const { wallet, marginfi } = await getSolanaModules();
    const keypair = wallet.loadSolanaKeypair();
    const connection = wallet.getSolanaConnection();

    const account = await marginfi.getMarginfiHealth(connection, keypair);

    if (!account) {
      return 'No active MarginFi account found.';
    }

    const hf = account.healthFactor;
    let riskLevel = 'SAFE';
    if (hf < 1.1) riskLevel = 'CRITICAL';
    else if (hf < 1.25) riskLevel = 'HIGH';
    else if (hf < 1.5) riskLevel = 'MEDIUM';
    else if (hf < 2) riskLevel = 'LOW';

    return `**MarginFi Health Check**\n\n` +
      `Health Factor: **${hf === Infinity ? '∞' : hf.toFixed(2)}**\n` +
      `Risk Level: **${riskLevel}**\n` +
      `LTV: ${account.ltv.toFixed(1)}%\n\n` +
      `Total Deposits: $${(parseFloat(account.totalDepositValue) || 0).toFixed(2)}\n` +
      `Total Borrows: $${(parseFloat(account.totalBorrowValue) || 0).toFixed(2)}`;
  } catch (error) {
    return wrapSkillError('MarginFi', 'health check', error);
  }
}

async function handleBanks(): Promise<string> {
  try {
    const { wallet, marginfi } = await getSolanaModules();
    const connection = wallet.getSolanaConnection();

    const banks = await marginfi.getMarginfiBanks(connection);

    if (banks.length === 0) {
      return 'No banks found.';
    }

    let output = `**MarginFi Banks** (${banks.length})\n\n`;

    for (const bank of banks.slice(0, 15)) {
      output += `**${bank.symbol}**\n`;
      output += `  Supply APY: ${bank.depositRate.toFixed(2)}% | Borrow APY: ${bank.borrowRate.toFixed(2)}%\n`;
      output += `  Utilization: ${bank.utilizationRate.toFixed(1)}%\n`;
    }

    if (banks.length > 15) {
      output += `\n... and ${banks.length - 15} more`;
    }

    return output;
  } catch (error) {
    return wrapSkillError('MarginFi', 'banks', error);
  }
}

async function handleRates(): Promise<string> {
  try {
    const { wallet, marginfi } = await getSolanaModules();
    const connection = wallet.getSolanaConnection();

    const banks = await marginfi.getMarginfiBanks(connection);

    if (banks.length === 0) {
      return 'No banks found.';
    }

    let output = `**MarginFi Interest Rates**\n\n`;
    output += `| Token | Supply APY | Borrow APY | Util |\n`;
    output += `|-------|------------|------------|------|\n`;

    for (const bank of banks.slice(0, 20)) {
      output += `| ${bank.symbol.padEnd(5)} | ${bank.depositRate.toFixed(2).padStart(9)}% | ${bank.borrowRate.toFixed(2).padStart(9)}% | ${bank.utilizationRate.toFixed(0).padStart(3)}% |\n`;
    }

    return output;
  } catch (error) {
    return wrapSkillError('MarginFi', 'rates', error);
  }
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
    case 'account':
    case 'position':
    case 'pos':
      return handleAccount();
    case 'health':
      return handleHealth();
    case 'banks':
    case 'pools':
      return handleBanks();
    case 'rates':
      return handleRates();

    case 'help':
    default:
      return formatHelp({
        name: 'MarginFi',
        emoji: '🏦',
        description: 'Solana lending and borrowing on MarginFi',
        sections: [
          {
            title: 'Lending',
            commands: [
              { cmd: '/marginfi deposit <amount> <token>', description: 'Deposit collateral' },
              { cmd: '/marginfi withdraw <amount|all> <token>', description: 'Withdraw collateral' },
              { cmd: '/marginfi borrow <amount> <token>', description: 'Borrow assets' },
              { cmd: '/marginfi repay <amount|all> <token>', description: 'Repay borrowed assets' },
              { cmd: '/marginfi account', description: 'View your positions' },
              { cmd: '/marginfi health', description: 'Check health factor' },
            ],
          },
          {
            title: 'Info',
            commands: [
              { cmd: '/marginfi banks', description: 'List all lending pools' },
              { cmd: '/marginfi rates', description: 'View supply/borrow rates' },
            ],
          },
        ],
        examples: [
          '/marginfi deposit 100 USDC',
          '/marginfi borrow 50 SOL',
          '/marginfi health',
          '/marginfi rates',
        ],
        seeAlso: [
          { cmd: '/kamino', description: 'Kamino Finance lending' },
          { cmd: '/solend', description: 'Solend lending' },
          { cmd: '/jup', description: 'Jupiter aggregator' },
          { cmd: '/bags', description: 'Wallet balances' },
        ],
      });
  }
}

export default {
  name: 'marginfi',
  description: 'MarginFi - Solana lending and borrowing',
  commands: ['/marginfi'],
  handle: execute,
};
