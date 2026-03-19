/**
 * Bags.fm CLI Skill - Complete API Coverage
 *
 * Solana token launchpad and trading platform with creator monetization.
 * Base URL: https://public-api-v2.bags.fm/api/v1/
 *
 * Commands:
 *
 * TRADING:
 * /bags quote <amount> <from> to <to> - Get swap quote
 * /bags swap <amount> <from> to <to> - Execute swap
 *
 * DISCOVERY:
 * /bags pools - List all Bags pools
 * /bags trending - Show trending tokens
 * /bags token <mint> - Get token info
 * /bags creators <mint> - Get token creators
 * /bags lifetime-fees <mint> - Get total fees collected
 *
 * FEE CLAIMING:
 * /bags fees <wallet> - Check claimable fees (all positions)
 * /bags claim <wallet> - Claim accumulated fees
 * /bags claim-events <mint> [--from <timestamp>] [--to <timestamp>] - Get claim history
 * /bags stats <mint> - Token claim statistics per claimer
 *
 * TOKEN LAUNCH:
 * /bags launch <name> <symbol> <description> [--image <url>] [--twitter <handle>] [--website <url>] - Launch new token
 * /bags launch-info - Show launch requirements and fees
 *
 * FEE SHARE CONFIG:
 * /bags fee-config <mint> <claimer1:bps> [claimer2:bps...] - Create fee share config (bps must sum to 10000)
 *
 * WALLET LOOKUP:
 * /bags wallet <provider> <username> - Lookup wallet by social (twitter/github/kick)
 * /bags wallets <provider> <user1,user2,...> - Bulk wallet lookup
 *
 * PARTNER SYSTEM:
 * /bags partner-config <mint> - Create partner config for fee sharing
 * /bags partner-claim <wallet> - Claim partner fees
 * /bags partner-stats <partner-key> - Get partner statistics
 */

const BAGS_API_BASE = 'https://public-api-v2.bags.fm/api/v1';

// ============================================================================
// Types
// ============================================================================

/** Wrapped response from Bags API — all responses have { success, response } */
interface BagsApiResponse<T> {
  success: boolean;
  response: T;
  error?: string;
}

interface BagsQuoteResponse {
  requestId: string;
  inAmount: string;
  outAmount: string;
  minOutAmount: string;
  inputMint: string;
  outputMint: string;
  priceImpactPct: string;
  slippageBps: number;
  routePlan: Array<{
    venue: string;
    inAmount: string;
    outAmount: string;
    inputMint: string;
    outputMint: string;
  }>;
  platformFee?: {
    amount: string;
    feeBps: number;
  } | null;
}

interface BagsPool {
  tokenMint: string;
  dbcConfigKey: string;
  dbcPoolKey: string;
  dammV2PoolKey?: string | null;
}

interface ClaimablePosition {
  baseMint: string;
  quoteMint?: string | null;
  virtualPool?: string;
  virtualPoolClaimableAmount?: number | null;
  dammPoolClaimableAmount?: number | null;
  isCustomFeeVault?: boolean;
  isMigrated?: boolean;
  totalClaimableLamportsUserShare: number;
  claimableDisplayAmount?: number | null;
  user?: string | null;
  claimerIndex?: number | null;
  userBps?: number | null;
}

interface TokenCreator {
  wallet: string;
  username: string;
  pfp?: string;
  royaltyBps: number;
  isCreator: boolean;
  provider?: string | null;
  providerUsername?: string | null;
}

interface ClaimEvent {
  wallet: string;
  isCreator: boolean;
  amount: string; // lamports as string
  signature: string;
  timestamp: string; // ISO 8601
}

interface ClaimStat {
  wallet: string;
  username: string;
  pfp?: string;
  royaltyBps: number;
  isCreator: boolean;
  provider?: string | null;
  providerUsername?: string | null;
  totalClaimed: string; // lamports as string
}

interface PartnerStats {
  partnerKey: string;
  totalLaunches: number;
  totalFeesEarned: number;
  claimableAmount: number;
  tokens: Array<{ mint: string; feesEarned: number }>;
}

interface TokenLaunchResult {
  tokenMint: string;
  metadataUrl: string;
  signature: string;
}

// ============================================================================
// API Client
// ============================================================================

function getApiKey(): string | null {
  return process.env.BAGS_API_KEY || null;
}

async function bagsRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('BAGS_API_KEY not configured. Get one at dev.bags.fm');
  }

  const url = endpoint.startsWith('http') ? endpoint : `${BAGS_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Bags API error: ${response.status} - ${error}`);
  }

  const json = await response.json() as BagsApiResponse<T>;
  if (json.success === false) {
    throw new Error(`Bags API error: ${json.error || 'Unknown error'}`);
  }
  // Unwrap { success, response } envelope
  return (json.response !== undefined ? json.response : json) as T;
}

// ============================================================================
// Trading Handlers
// ============================================================================

async function handleQuote(args: string[]): Promise<string> {
  const toIndex = args.findIndex(a => a.toLowerCase() === 'to');
  if (toIndex < 2 || toIndex >= args.length - 1) {
    return 'Usage: /bags quote <amount> <from> to <to>\nExample: /bags quote 1 SOL to USDC';
  }

  const amount = args[0];
  const fromToken = args.slice(1, toIndex).join('');
  const toToken = args.slice(toIndex + 1).join('');

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return 'Invalid amount. Must be a positive number.';
  }

  try {
    const { resolveTokenMints, getTokenList } = await import('../../../solana/tokenlist');
    const [fromMint, toMint] = await resolveTokenMints([fromToken, toToken]);

    if (!fromMint || !toMint) {
      return `Could not resolve tokens: ${fromToken}, ${toToken}`;
    }

    // Look up decimals for amount conversion (API expects smallest unit)
    const tokens = await getTokenList();
    const fromDecimals = tokens.find(t => t.address === fromMint)?.decimals ?? 9;
    const toDecimals = tokens.find(t => t.address === toMint)?.decimals ?? 9;
    const amountSmallest = Math.floor(parsedAmount * Math.pow(10, fromDecimals)).toString();

    const quote = await bagsRequest<BagsQuoteResponse>(
      `/trade/quote?inputMint=${fromMint}&outputMint=${toMint}&amount=${amountSmallest}&slippageMode=auto`
    );

    // Convert output from smallest unit to human-readable
    const outHuman = (parseFloat(quote.outAmount) / Math.pow(10, toDecimals)).toFixed(Math.min(toDecimals, 9));
    const minOutHuman = (parseFloat(quote.minOutAmount) / Math.pow(10, toDecimals)).toFixed(Math.min(toDecimals, 9));

    return `**Bags Quote**\n\n` +
      `${amount} ${fromToken} -> ${toToken}\n` +
      `Output: ${outHuman} ${toToken}\n` +
      `Min Output: ${minOutHuman} ${toToken}\n` +
      `Price Impact: ${quote.priceImpactPct}%\n` +
      `Slippage: ${(quote.slippageBps / 100).toFixed(2)}%`;
  } catch (error) {
    return `Quote failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function handleSwap(args: string[]): Promise<string> {
  const toIndex = args.findIndex(a => a.toLowerCase() === 'to');
  if (toIndex < 2 || toIndex >= args.length - 1) {
    return 'Usage: /bags swap <amount> <from> to <to>\nExample: /bags swap 1 SOL to USDC';
  }

  const amount = args[0];
  const fromToken = args.slice(1, toIndex).join('');
  const toToken = args.slice(toIndex + 1).join('');

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return 'Invalid amount. Must be a positive number.';
  }

  try {
    const { resolveTokenMints, getTokenList } = await import('../../../solana/tokenlist');
    const { loadSolanaKeypair, getSolanaConnection } = await import('../../../solana/wallet');

    const [fromMint, toMint] = await resolveTokenMints([fromToken, toToken]);
    if (!fromMint || !toMint) {
      return `Could not resolve tokens: ${fromToken}, ${toToken}`;
    }

    const keypair = loadSolanaKeypair();
    const walletAddress = keypair.publicKey.toBase58();

    // Look up decimals for amount conversion (API expects smallest unit)
    const tokens = await getTokenList();
    const fromDecimals = tokens.find(t => t.address === fromMint)?.decimals ?? 9;
    const toDecimals = tokens.find(t => t.address === toMint)?.decimals ?? 9;
    const amountSmallest = Math.floor(parsedAmount * Math.pow(10, fromDecimals)).toString();

    // Step 1: Get quote
    const quote = await bagsRequest<BagsQuoteResponse>(
      `/trade/quote?inputMint=${fromMint}&outputMint=${toMint}&amount=${amountSmallest}&slippageMode=auto`
    );

    // Step 2: Create swap transaction from quote
    const txResponse = await bagsRequest<{ swapTransaction: string; lastValidBlockHeight: number }>('/trade/swap', {
      method: 'POST',
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: walletAddress,
      }),
    });

    // Step 3: Sign and send transaction (Base58 encoded)
    const connection = getSolanaConnection();
    const { bs58 } = await import('@coral-xyz/anchor/dist/cjs/utils/bytes');
    const { VersionedTransaction } = await import('@solana/web3.js');
    const txBuffer = bs58.decode(txResponse.swapTransaction);
    const tx = VersionedTransaction.deserialize(txBuffer);
    tx.sign([keypair]);

    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(signature, 'confirmed');

    // Convert output to human-readable
    const outHuman = (parseFloat(quote.outAmount) / Math.pow(10, toDecimals)).toFixed(Math.min(toDecimals, 9));

    return `**Bags Swap Complete**\n\n` +
      `${amount} ${fromToken} -> ${outHuman} ${toToken}\n` +
      `TX: \`${signature}\``;
  } catch (error) {
    return `Swap failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ============================================================================
// Discovery Handlers
// ============================================================================

async function handlePools(): Promise<string> {
  try {
    const pools = await bagsRequest<BagsPool[]>('/solana/bags/pools');

    if (!pools || pools.length === 0) {
      return 'No Bags pools found.';
    }

    let output = `**Bags Pools** (${pools.length})\n\n`;
    for (const pool of pools.slice(0, 20)) {
      output += `**${pool.tokenMint.slice(0, 12)}...**\n`;
      output += `  Mint: \`${pool.tokenMint}\`\n`;
      output += `  DBC Pool: \`${pool.dbcPoolKey.slice(0, 16)}...\`\n`;
      if (pool.dammV2PoolKey) output += `  DAMM v2: \`${pool.dammV2PoolKey.slice(0, 16)}...\`\n`;
      output += `  Migrated: ${pool.dammV2PoolKey ? 'Yes' : 'No'}\n\n`;
    }
    return output;
  } catch (error) {
    return `Error fetching pools: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function handleTrending(): Promise<string> {
  try {
    // Pools endpoint returns all pools with migrated DAMM v2 pools being the active ones
    const pools = await bagsRequest<BagsPool[]>('/solana/bags/pools?onlyMigrated=true');

    if (!pools || pools.length === 0) {
      return 'No migrated pools found on Bags.fm.';
    }

    let output = `**Active Bags.fm Pools** (migrated to DAMM v2)\n\n`;
    for (let i = 0; i < Math.min(pools.length, 20); i++) {
      const pool = pools[i];
      output += `${i + 1}. \`${pool.tokenMint.slice(0, 16)}...\`\n`;
      if (pool.dammV2PoolKey) output += `   DAMM v2: \`${pool.dammV2PoolKey.slice(0, 16)}...\`\n`;
    }
    return output;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function handleToken(mint: string): Promise<string> {
  if (!mint) {
    return 'Usage: /bags token <mint>';
  }

  try {
    const [creators, lifetimeFees] = await Promise.all([
      bagsRequest<TokenCreator[]>(`/token-launch/creator/v3?tokenMint=${mint}`).catch(() => null),
      bagsRequest<string>(`/token-launch/lifetime-fees?tokenMint=${mint}`).catch(() => null),
    ]);

    let output = `**Bags Token**\n\n`;
    output += `Mint: \`${mint}\`\n`;

    if (creators && creators.length > 0) {
      output += `\n**Creators (${creators.length}):**\n`;
      for (const creator of creators.slice(0, 5)) {
        output += `  - \`${creator.wallet.slice(0, 12)}...\``;
        if (creator.username) output += ` (${creator.username})`;
        if (creator.providerUsername && creator.provider) output += ` @${creator.providerUsername} [${creator.provider}]`;
        output += ` - ${(creator.royaltyBps / 100).toFixed(1)}%`;
        if (creator.isCreator) output += ' (creator)';
        output += '\n';
      }
    }

    if (lifetimeFees) {
      const feeLamports = BigInt(lifetimeFees);
      const feeSol = Number(feeLamports) / 1e9;
      output += `\n**Fee Stats:**\n`;
      output += `  Lifetime Fees: ${feeSol.toFixed(4)} SOL (${feeLamports.toString()} lamports)\n`;
    }

    return output;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function handleCreators(mint: string): Promise<string> {
  if (!mint) {
    return 'Usage: /bags creators <mint>';
  }

  try {
    const creators = await bagsRequest<TokenCreator[]>(
      `/token-launch/creator/v3?tokenMint=${mint}`
    );

    if (!creators || creators.length === 0) {
      return `No creators found for token ${mint.slice(0, 12)}...`;
    }

    let output = `**Token Creators**\n\nMint: \`${mint.slice(0, 20)}...\`\n\n`;
    let totalBps = 0;

    for (const creator of creators) {
      output += `**${creator.username || creator.wallet.slice(0, 12) + '...'}**\n`;
      output += `  Wallet: \`${creator.wallet}\`\n`;
      if (creator.provider) output += `  Provider: ${creator.provider}\n`;
      if (creator.providerUsername) output += `  Handle: @${creator.providerUsername}\n`;
      output += `  Share: ${(creator.royaltyBps / 100).toFixed(2)}%\n`;
      output += `  Is Creator: ${creator.isCreator ? 'Yes' : 'No'}\n\n`;
      totalBps += creator.royaltyBps;
    }

    output += `**Total Share: ${(totalBps / 100).toFixed(2)}%**`;
    return output;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function handleLifetimeFees(mint: string): Promise<string> {
  if (!mint) {
    return 'Usage: /bags lifetime-fees <mint>';
  }

  try {
    const feeLamportsStr = await bagsRequest<string>(
      `/token-launch/lifetime-fees?tokenMint=${mint}`
    );

    const feeLamports = BigInt(feeLamportsStr);
    const feeSol = Number(feeLamports) / 1e9;

    let output = `**Lifetime Fees**\n\nMint: \`${mint.slice(0, 20)}...\`\n\n`;
    output += `Total Fees Collected: **${feeSol.toFixed(4)} SOL** (${feeLamports.toString()} lamports)\n`;

    return output;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ============================================================================
// Fee Claiming Handlers
// ============================================================================

async function handleFees(walletArg: string): Promise<string> {
  let walletAddress = walletArg;

  if (!walletAddress) {
    // Use configured wallet if not provided
    try {
      const { loadSolanaKeypair } = await import('../../../solana/wallet');
      const keypair = loadSolanaKeypair();
      walletAddress = keypair.publicKey.toBase58();
    } catch {
      return 'Usage: /bags fees <wallet>\nOr configure SOLANA_PRIVATE_KEY to use your wallet.';
    }
  }

  try {
    const positions = await bagsRequest<ClaimablePosition[]>(
      `/token-launch/claimable-positions?wallet=${walletAddress}`
    );

    if (!positions || positions.length === 0) {
      return `No claimable fees for wallet ${walletAddress.slice(0, 12)}...`;
    }

    let output = `**Claimable Fees**\n\nWallet: \`${walletAddress.slice(0, 12)}...\`\n\n`;
    let totalClaimableLamports = 0;

    for (const pos of positions) {
      output += `**${pos.baseMint.slice(0, 12)}...**\n`;
      output += `  Mint: \`${pos.baseMint}\`\n`;

      if (pos.virtualPoolClaimableAmount) {
        output += `  Virtual Pool: ${pos.virtualPoolClaimableAmount} lamports\n`;
      }
      if (pos.dammPoolClaimableAmount) {
        output += `  DAMM Pool: ${pos.dammPoolClaimableAmount} lamports\n`;
      }
      if (pos.claimableDisplayAmount) {
        output += `  Display Amount: ${pos.claimableDisplayAmount}\n`;
      }

      const totalLamports = pos.totalClaimableLamportsUserShare;
      const totalSol = totalLamports / 1e9;
      output += `  **Total: ${totalSol.toFixed(6)} SOL**\n`;
      if (pos.userBps) output += `  Share: ${(pos.userBps / 100).toFixed(1)}%\n`;
      output += '\n';
      totalClaimableLamports += totalLamports;
    }

    const grandTotalSol = totalClaimableLamports / 1e9;
    output += `\n**Grand Total: ${grandTotalSol.toFixed(6)} SOL**\n`;
    output += `\nUse \`/bags claim ${walletAddress}\` to claim fees.`;
    return output;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function handleClaim(walletArg: string): Promise<string> {
  try {
    const { loadSolanaKeypair, getSolanaConnection } = await import('../../../solana/wallet');
    const keypair = loadSolanaKeypair();
    const walletAddress = walletArg || keypair.publicKey.toBase58();

    // Verify wallet matches if specified
    if (walletArg && keypair.publicKey.toBase58() !== walletArg) {
      return `Wallet mismatch. Your configured wallet is ${keypair.publicKey.toBase58().slice(0, 12)}...`;
    }

    // Get all claimable positions first
    const positions = await bagsRequest<ClaimablePosition[]>(
      `/token-launch/claimable-positions?wallet=${walletAddress}`
    );

    if (!positions || positions.length === 0) {
      return 'No fees to claim.';
    }

    const connection = getSolanaConnection();
    const { VersionedTransaction, Transaction } = await import('@solana/web3.js');
    const { bs58 } = await import('@coral-xyz/anchor/dist/cjs/utils/bytes');
    const signatures: string[] = [];
    let totalClaimedLamports = 0;

    // Claim per token — v3 endpoint requires tokenMint
    for (const pos of positions) {
      if (pos.totalClaimableLamportsUserShare <= 0) continue;

      try {
        const claimResult = await bagsRequest<Array<{ tx: string; blockhash: { blockhash: string; lastValidBlockHeight: number } }>>(
          `/token-launch/claim-txs/v3`,
          {
            method: 'POST',
            body: JSON.stringify({
              feeClaimer: walletAddress,
              tokenMint: pos.baseMint,
            }),
          }
        );

        if (!claimResult || claimResult.length === 0) continue;

        for (const claimTx of claimResult) {
          // Claim txs are Base58 encoded legacy transactions
          const txBuffer = bs58.decode(claimTx.tx);
          let sig: string;
          try {
            const tx = VersionedTransaction.deserialize(txBuffer);
            tx.sign([keypair]);
            sig = await connection.sendRawTransaction(tx.serialize());
          } catch {
            // Fall back to legacy Transaction
            const tx = Transaction.from(txBuffer);
            tx.sign(keypair);
            sig = await connection.sendRawTransaction(tx.serialize());
          }
          await connection.confirmTransaction(sig, 'confirmed');
          signatures.push(sig);
        }

        totalClaimedLamports += pos.totalClaimableLamportsUserShare;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[bags] Claim failed for ${pos.baseMint}: ${msg}`);
      }
    }

    if (signatures.length === 0) {
      return 'No claim transactions generated. Fees may already be claimed.';
    }

    const totalSol = totalClaimedLamports / 1e9;

    return `**Fees Claimed Successfully**\n\n` +
      `Amount: ${totalSol.toFixed(6)} SOL\n` +
      `Positions: ${positions.length}\n` +
      `Transactions: ${signatures.length}\n\n` +
      signatures.map(s => `- \`${s.slice(0, 24)}...\``).join('\n');
  } catch (error) {
    return `Claim failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function handleClaimEvents(args: string[]): Promise<string> {
  if (args.length === 0) {
    return 'Usage: /bags claim-events <mint> [--from <timestamp>] [--to <timestamp>]';
  }

  const mint = args[0];
  let fromTs: number | undefined;
  let toTs: number | undefined;

  // Parse optional flags
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) {
      fromTs = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--to' && args[i + 1]) {
      toTs = parseInt(args[i + 1], 10);
      i++;
    }
  }

  try {
    let endpoint = `/fee-share/token/claim-events?tokenMint=${mint}`;
    if (fromTs || toTs) {
      endpoint += '&mode=time';
      if (fromTs) endpoint += `&from=${fromTs}`;
      if (toTs) endpoint += `&to=${toTs}`;
    }

    const result = await bagsRequest<{ events: ClaimEvent[] }>(endpoint);

    if (!result.events || result.events.length === 0) {
      return `No claim events for token ${mint.slice(0, 12)}...`;
    }

    let output = `**Claim Events**\n\nMint: \`${mint.slice(0, 20)}...\`\n\n`;
    let totalClaimedLamports = 0n;

    for (const event of result.events.slice(0, 20)) {
      const date = new Date(event.timestamp).toLocaleString();
      const amountLamports = BigInt(event.amount);
      const amountSol = Number(amountLamports) / 1e9;
      output += `**${event.wallet.slice(0, 12)}...** claimed ${amountSol.toFixed(6)} SOL`;
      if (event.isCreator) output += ' (creator)';
      output += '\n';
      output += `  ${date} | \`${event.signature.slice(0, 16)}...\`\n\n`;
      totalClaimedLamports += amountLamports;
    }

    const totalSol = Number(totalClaimedLamports) / 1e9;
    output += `\n**Total Claimed: ${totalSol.toFixed(6)} SOL**`;
    if (result.events.length > 20) {
      output += `\n(Showing 20 of ${result.events.length} events)`;
    }

    return output;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function handleStats(mint: string): Promise<string> {
  if (!mint) {
    return 'Usage: /bags stats <mint>';
  }

  try {
    const claimers = await bagsRequest<ClaimStat[]>(
      `/token-launch/claim-stats?tokenMint=${mint}`
    );

    if (!claimers || claimers.length === 0) {
      return `No claim stats for token ${mint.slice(0, 12)}...`;
    }

    let output = `**Token Claim Stats**\n\nMint: \`${mint.slice(0, 20)}...\`\n\n`;
    let totalClaimedLamports = 0n;

    for (const claimer of claimers) {
      const claimedLamports = BigInt(claimer.totalClaimed);
      const claimedSol = Number(claimedLamports) / 1e9;
      output += `**${claimer.username || claimer.wallet.slice(0, 12) + '...'}**\n`;
      output += `  Wallet: \`${claimer.wallet.slice(0, 16)}...\`\n`;
      output += `  Total Claimed: ${claimedSol.toFixed(6)} SOL\n`;
      output += `  Share: ${(claimer.royaltyBps / 100).toFixed(1)}%\n`;
      if (claimer.isCreator) output += `  Role: Creator\n`;
      if (claimer.provider && claimer.providerUsername) output += `  Social: @${claimer.providerUsername} [${claimer.provider}]\n`;
      output += '\n';
      totalClaimedLamports += claimedLamports;
    }

    const totalSol = Number(totalClaimedLamports) / 1e9;
    output += `**Total Claimed: ${totalSol.toFixed(6)} SOL**`;

    return output;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ============================================================================
// Token Launch Handlers
// ============================================================================

async function handleLaunch(args: string[]): Promise<string> {
  if (args.length < 3) {
    return `Usage: /bags launch <name> <symbol> <description> [options]

Options:
  --image <url>       Token image URL (or will be uploaded)
  --twitter <handle>  Twitter handle
  --website <url>     Website URL
  --telegram <url>    Telegram URL
  --initial <SOL>     Initial buy amount in SOL (default: 0)

Example:
  /bags launch "My Token" MTK "A great token" --twitter mytoken --initial 0.1`;
  }

  const name = args[0];
  const symbol = args[1];
  const description = args[2];

  // Parse optional flags
  let imageUrl: string | undefined;
  let twitter: string | undefined;
  let website: string | undefined;
  let telegram: string | undefined;
  let initialBuyLamports = 0;

  for (let i = 3; i < args.length; i++) {
    const flag = args[i];
    const value = args[i + 1];
    if (flag === '--image' && value) { imageUrl = value; i++; }
    else if (flag === '--twitter' && value) { twitter = value; i++; }
    else if (flag === '--website' && value) { website = value; i++; }
    else if (flag === '--telegram' && value) { telegram = value; i++; }
    else if (flag === '--initial' && value) {
      const parsed = parseFloat(value);
      if (!isNaN(parsed) && parsed > 0) initialBuyLamports = Math.floor(parsed * 1e9);
      i++;
    }
  }

  try {
    const { loadSolanaKeypair, getSolanaConnection } = await import('../../../solana/wallet');
    const keypair = loadSolanaKeypair();
    const walletAddress = keypair.publicKey.toBase58();

    // Step 1: Create token info and metadata (multipart/form-data)
    const formData = new FormData();
    formData.append('name', name);
    formData.append('symbol', symbol);
    formData.append('description', description);
    if (twitter) formData.append('twitter', twitter);
    if (website) formData.append('website', website);
    if (telegram) formData.append('telegram', telegram);
    if (imageUrl) formData.append('imageUrl', imageUrl);

    const apiKey = getApiKey();
    if (!apiKey) throw new Error('BAGS_API_KEY not configured');

    const tokenInfoRes = await fetch(`${BAGS_API_BASE}/token-launch/create-token-info`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey },
      body: formData,
    });
    if (!tokenInfoRes.ok) {
      const err = await tokenInfoRes.text();
      throw new Error(`Token info creation failed: ${tokenInfoRes.status} - ${err}`);
    }
    const tokenInfoJson = await tokenInfoRes.json() as BagsApiResponse<{ tokenMint: string; tokenMetadata: string }>;
    if (!tokenInfoJson.success) throw new Error(`Token info error: ${tokenInfoJson.error}`);
    const tokenInfo = tokenInfoJson.response;

    // Step 2: Create fee share config (100% to creator by default)
    const feeConfig = await bagsRequest<{ configKey: string; transactions: string[] }>(
      '/token-launch/fee-share/create-config',
      {
        method: 'POST',
        body: JSON.stringify({
          payer: walletAddress,
          baseMint: tokenInfo.tokenMint,
          feeClaimers: [{ user: walletAddress, userBps: 10000 }],
        }),
      }
    );

    // Sign and send fee config transactions (Base58 encoded)
    const connection = getSolanaConnection();
    const { VersionedTransaction, Transaction } = await import('@solana/web3.js');
    const { bs58 } = await import('@coral-xyz/anchor/dist/cjs/utils/bytes');

    for (const txStr of feeConfig.transactions) {
      const txBuffer = bs58.decode(txStr);
      try {
        const tx = VersionedTransaction.deserialize(txBuffer);
        tx.sign([keypair]);
        const sig = await connection.sendRawTransaction(tx.serialize());
        await connection.confirmTransaction(sig, 'confirmed');
      } catch {
        const tx = Transaction.from(txBuffer);
        tx.sign(keypair);
        const sig = await connection.sendRawTransaction(tx.serialize());
        await connection.confirmTransaction(sig, 'confirmed');
      }
    }

    // Step 3: Create launch transaction (correct field names: ipfs, wallet)
    const launchTxStr = await bagsRequest<string>(
      '/token-launch/create-launch-transaction',
      {
        method: 'POST',
        body: JSON.stringify({
          ipfs: tokenInfo.tokenMetadata,
          tokenMint: tokenInfo.tokenMint,
          wallet: walletAddress,
          initialBuyLamports,
          configKey: feeConfig.configKey,
        }),
      }
    );

    // Sign and send launch transaction (Base58 encoded)
    const launchTxBuffer = bs58.decode(launchTxStr);
    let signature: string;
    try {
      const tx = VersionedTransaction.deserialize(launchTxBuffer);
      tx.sign([keypair]);
      signature = await connection.sendRawTransaction(tx.serialize());
    } catch {
      const tx = Transaction.from(launchTxBuffer);
      tx.sign(keypair);
      signature = await connection.sendRawTransaction(tx.serialize());
    }
    await connection.confirmTransaction(signature, 'confirmed');

    return `**Token Launched Successfully!**\n\n` +
      `Name: ${name}\n` +
      `Symbol: ${symbol}\n` +
      `Mint: \`${tokenInfo.tokenMint}\`\n` +
      `Metadata: ${tokenInfo.tokenMetadata}\n` +
      `TX: \`${signature}\`\n\n` +
      `Your token is now live on Bags.fm! You earn 1% of all trading volume.`;
  } catch (error) {
    return `Launch failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function handleLaunchInfo(): Promise<string> {
  return `**Bags.fm Token Launch**

**Requirements:**
- BAGS_API_KEY from dev.bags.fm
- SOLANA_PRIVATE_KEY for signing
- SOL for transaction fees (~0.05 SOL)

**Features:**
- 1% creator fee on all trades
- Up to 100 fee claimers per token
- Automatic Meteora DAMM pool creation
- Social links (Twitter, Telegram, Website)

**Fee Distribution:**
- Default: 100% to creator
- Custom: Split between up to 100 wallets
- Claim fees anytime with /bags claim

**Launch Steps:**
1. /bags launch <name> <symbol> <desc> [options]
2. Token is created with metadata on IPFS
3. Fee share config is set up
4. Token launches on Meteora pool
5. Trading starts immediately

**Cost:** ~0.05 SOL (Solana transaction fees only)`;
}

// ============================================================================
// Fee Share Config Handlers
// ============================================================================

async function handleFeeConfig(args: string[]): Promise<string> {
  if (args.length < 2) {
    return `Usage: /bags fee-config <mint> <claimer1:bps> [claimer2:bps ...]

BPS (basis points) must sum to 10000 (100%)

Examples:
  /bags fee-config <mint> wallet1:5000 wallet2:5000   # 50/50 split
  /bags fee-config <mint> wallet1:7000 wallet2:3000   # 70/30 split
  /bags fee-config <mint> wallet1:10000               # 100% to one wallet`;
  }

  const mint = args[0];
  const claimerArgs = args.slice(1);

  const feeClaimers: Array<{ user: string; userBps: number }> = [];
  let totalBps = 0;

  for (const arg of claimerArgs) {
    const [wallet, bpsStr] = arg.split(':');
    if (!wallet || !bpsStr) {
      return `Invalid claimer format: ${arg}. Use wallet:bps format.`;
    }
    const bps = parseInt(bpsStr, 10);
    if (isNaN(bps) || bps < 0 || bps > 10000) {
      return `Invalid BPS value: ${bpsStr}. Must be 0-10000.`;
    }
    feeClaimers.push({ user: wallet, userBps: bps });
    totalBps += bps;
  }

  if (totalBps !== 10000) {
    return `BPS must sum to 10000. Current total: ${totalBps}`;
  }

  try {
    const { loadSolanaKeypair, getSolanaConnection } = await import('../../../solana/wallet');
    const keypair = loadSolanaKeypair();
    const walletAddress = keypair.publicKey.toBase58();

    const result = await bagsRequest<{ configKey: string; transactions: string[] }>(
      '/token-launch/fee-share/create-config',
      {
        method: 'POST',
        body: JSON.stringify({
          payer: walletAddress,
          baseMint: mint,
          feeClaimers,
        }),
      }
    );

    // Sign and send transactions (Base58 encoded)
    const connection = getSolanaConnection();
    const { VersionedTransaction, Transaction } = await import('@solana/web3.js');
    const { bs58 } = await import('@coral-xyz/anchor/dist/cjs/utils/bytes');
    const signatures: string[] = [];

    for (const txStr of result.transactions) {
      const txBuffer = bs58.decode(txStr);
      try {
        const tx = VersionedTransaction.deserialize(txBuffer);
        tx.sign([keypair]);
        const sig = await connection.sendRawTransaction(tx.serialize());
        await connection.confirmTransaction(sig, 'confirmed');
        signatures.push(sig);
      } catch {
        const tx = Transaction.from(txBuffer);
        tx.sign(keypair);
        const sig = await connection.sendRawTransaction(tx.serialize());
        await connection.confirmTransaction(sig, 'confirmed');
        signatures.push(sig);
      }
    }

    let output = `**Fee Share Config Created**\n\n`;
    output += `Mint: \`${mint.slice(0, 20)}...\`\n`;
    output += `Config Key: \`${result.configKey}\`\n\n`;
    output += `**Fee Distribution:**\n`;
    for (const claimer of feeClaimers) {
      output += `  ${claimer.user.slice(0, 12)}... - ${(claimer.userBps / 100).toFixed(1)}%\n`;
    }
    output += `\nTransactions: ${signatures.length}`;

    return output;
  } catch (error) {
    return `Config creation failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ============================================================================
// Wallet Lookup Handlers
// ============================================================================

async function handleWalletLookup(args: string[]): Promise<string> {
  if (args.length < 2) {
    return `Usage: /bags wallet <provider> <username>

Providers: twitter, github, kick, tiktok, instagram, onlyfans, solana

Examples:
  /bags wallet twitter elonmusk
  /bags wallet github vbuterin`;
  }

  const provider = args[0].toLowerCase();
  const username = args[1];

  const validProviders = ['twitter', 'github', 'kick', 'tiktok', 'instagram', 'onlyfans', 'solana', 'apple', 'google', 'email', 'moltbook'];
  if (!validProviders.includes(provider)) {
    return `Invalid provider: ${provider}. Use: ${validProviders.join(', ')}`;
  }

  try {
    const result = await bagsRequest<{ wallet: string; provider: string; platformData: { username: string; display_name?: string } }>(
      `/token-launch/fee-share/wallet/v2?provider=${provider}&username=${username}`
    );

    return `**Wallet Lookup**\n\n` +
      `Provider: ${result.provider}\n` +
      `Username: @${result.platformData.username}\n` +
      (result.platformData.display_name ? `Display Name: ${result.platformData.display_name}\n` : '') +
      `Wallet: \`${result.wallet}\``;
  } catch (error) {
    return `Lookup failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function handleBulkWalletLookup(args: string[]): Promise<string> {
  if (args.length < 2) {
    return `Usage: /bags wallets <provider> <user1,user2,user3,...>

Example:
  /bags wallets twitter user1,user2,user3`;
  }

  const provider = args[0].toLowerCase();
  const usernames = args[1].split(',').map(u => u.trim());

  const validProviders = ['twitter', 'github', 'kick', 'tiktok', 'instagram', 'onlyfans', 'solana', 'apple', 'google', 'email', 'moltbook'];
  if (!validProviders.includes(provider)) {
    return `Invalid provider: ${provider}. Use: ${validProviders.join(', ')}`;
  }

  try {
    // Bulk endpoint expects items array with per-item provider
    const items = usernames.map(username => ({ username, provider }));
    const result = await bagsRequest<Array<{ username: string; provider: string; wallet: string | null; platformData?: { username: string } }>>(
      '/token-launch/fee-share/wallet/v2/bulk',
      {
        method: 'POST',
        body: JSON.stringify({ items }),
      }
    );

    let output = `**Bulk Wallet Lookup** (${provider})\n\n`;
    for (const entry of result) {
      output += `@${entry.username}: ${entry.wallet ? `\`${entry.wallet}\`` : 'Not found'}\n`;
    }
    return output;
  } catch (error) {
    return `Lookup failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ============================================================================
// Partner System Handlers
// ============================================================================

async function handlePartnerConfig(mint: string): Promise<string> {
  if (!mint) {
    return 'Usage: /bags partner-config <mint>';
  }

  try {
    const { loadSolanaKeypair, getSolanaConnection } = await import('../../../solana/wallet');
    const keypair = loadSolanaKeypair();
    const walletAddress = keypair.publicKey.toBase58();

    const result = await bagsRequest<{ partnerKey: string; transaction: string }>(
      '/token-launch/fee-share/partner/create-config',
      {
        method: 'POST',
        body: JSON.stringify({
          payer: walletAddress,
          tokenMint: mint,
        }),
      }
    );

    // Sign and send transaction (Base58 encoded)
    const connection = getSolanaConnection();
    const { VersionedTransaction, Transaction } = await import('@solana/web3.js');
    const { bs58 } = await import('@coral-xyz/anchor/dist/cjs/utils/bytes');
    const txBuffer = bs58.decode(result.transaction);
    let signature: string;
    try {
      const tx = VersionedTransaction.deserialize(txBuffer);
      tx.sign([keypair]);
      signature = await connection.sendRawTransaction(tx.serialize());
    } catch {
      const tx = Transaction.from(txBuffer);
      tx.sign(keypair);
      signature = await connection.sendRawTransaction(tx.serialize());
    }
    await connection.confirmTransaction(signature, 'confirmed');

    return `**Partner Config Created**\n\n` +
      `Mint: \`${mint.slice(0, 20)}...\`\n` +
      `Partner Key: \`${result.partnerKey}\`\n` +
      `TX: \`${signature}\`\n\n` +
      `Use this partner key when launching tokens to earn referral fees.`;
  } catch (error) {
    return `Failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function handlePartnerClaim(walletArg: string): Promise<string> {
  try {
    const { loadSolanaKeypair, getSolanaConnection } = await import('../../../solana/wallet');
    const keypair = loadSolanaKeypair();
    const walletAddress = walletArg || keypair.publicKey.toBase58();

    const claimTxs = await bagsRequest<{ transactions: string[] }>(
      '/token-launch/fee-share/partner/claim',
      {
        method: 'POST',
        body: JSON.stringify({ wallet: walletAddress }),
      }
    );

    if (!claimTxs.transactions || claimTxs.transactions.length === 0) {
      return 'No partner fees to claim.';
    }

    const connection = getSolanaConnection();
    const { VersionedTransaction, Transaction } = await import('@solana/web3.js');
    const { bs58 } = await import('@coral-xyz/anchor/dist/cjs/utils/bytes');
    const signatures: string[] = [];

    for (const txStr of claimTxs.transactions) {
      const txBuffer = bs58.decode(txStr);
      try {
        const tx = VersionedTransaction.deserialize(txBuffer);
        tx.sign([keypair]);
        const sig = await connection.sendRawTransaction(tx.serialize());
        await connection.confirmTransaction(sig, 'confirmed');
        signatures.push(sig);
      } catch {
        const tx = Transaction.from(txBuffer);
        tx.sign(keypair);
        const sig = await connection.sendRawTransaction(tx.serialize());
        await connection.confirmTransaction(sig, 'confirmed');
        signatures.push(sig);
      }
    }

    return `**Partner Fees Claimed**\n\n` +
      `Transactions: ${signatures.length}\n` +
      signatures.map(s => `- \`${s.slice(0, 24)}...\``).join('\n');
  } catch (error) {
    return `Claim failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function handlePartnerStats(partnerKey: string): Promise<string> {
  if (!partnerKey) {
    return 'Usage: /bags partner-stats <partner-key>';
  }

  try {
    const stats = await bagsRequest<PartnerStats>(
      `/token-launch/fee-share/partner/stats?partnerKey=${partnerKey}`
    );

    let output = `**Partner Stats**\n\n`;
    output += `Partner Key: \`${stats.partnerKey.slice(0, 20)}...\`\n`;
    output += `Total Launches: ${stats.totalLaunches}\n`;
    output += `Total Fees Earned: $${stats.totalFeesEarned.toLocaleString()}\n`;
    output += `Claimable: $${stats.claimableAmount.toFixed(2)}\n\n`;

    if (stats.tokens.length > 0) {
      output += `**Tokens:**\n`;
      for (const token of stats.tokens.slice(0, 10)) {
        output += `  \`${token.mint.slice(0, 12)}...\` - $${token.feesEarned.toFixed(2)}\n`;
      }
    }

    return output;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ============================================================================
// Main Execute Function
// ============================================================================

export async function execute(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const command = parts[0]?.toLowerCase() || 'help';
  const rest = parts.slice(1);

  switch (command) {
    // Trading
    case 'quote':
      return handleQuote(rest);
    case 'swap':
      return handleSwap(rest);

    // Discovery
    case 'pools':
      return handlePools();
    case 'trending':
      return handleTrending();
    case 'token':
      return handleToken(rest[0]);
    case 'creators':
      return handleCreators(rest[0]);
    case 'lifetime-fees':
      return handleLifetimeFees(rest[0]);

    // Fee Claiming
    case 'fees':
      return handleFees(rest[0]);
    case 'claim':
      return handleClaim(rest[0]);
    case 'claim-events':
      return handleClaimEvents(rest);
    case 'stats':
      return handleStats(rest[0]);

    // Token Launch
    case 'launch':
      return handleLaunch(rest);
    case 'launch-info':
      return handleLaunchInfo();

    // Fee Share Config
    case 'fee-config':
      return handleFeeConfig(rest);

    // Wallet Lookup
    case 'wallet':
      return handleWalletLookup(rest);
    case 'wallets':
      return handleBulkWalletLookup(rest);

    // Partner System
    case 'partner-config':
      return handlePartnerConfig(rest[0]);
    case 'partner-claim':
      return handlePartnerClaim(rest[0]);
    case 'partner-stats':
      return handlePartnerStats(rest[0]);

    case 'help':
    default:
      return `**Bags.fm - Complete Solana Token Launchpad**

**Trading:**
  /bags quote <amount> <from> to <to>      Get swap quote
  /bags swap <amount> <from> to <to>       Execute swap

**Discovery:**
  /bags pools                              List all pools
  /bags trending                           Show trending tokens
  /bags token <mint>                       Full token info
  /bags creators <mint>                    Get token creators
  /bags lifetime-fees <mint>               Total fees collected

**Fee Claiming:**
  /bags fees [wallet]                      Check claimable fees
  /bags claim [wallet]                     Claim all fees
  /bags claim-events <mint> [--from/--to]  Claim history
  /bags stats <mint>                       Per-claimer statistics

**Token Launch:**
  /bags launch <name> <symbol> <desc>      Launch new token
  /bags launch-info                        Launch requirements

**Fee Share Config:**
  /bags fee-config <mint> <wallet:bps>...  Create fee distribution

**Wallet Lookup:**
  /bags wallet <provider> <username>       Lookup by social
  /bags wallets <provider> <user1,user2>   Bulk lookup

**Partner System:**
  /bags partner-config <mint>              Create partner key
  /bags partner-claim [wallet]             Claim partner fees
  /bags partner-stats <key>                View partner stats

**Setup:**
  export BAGS_API_KEY="your-key"           # From dev.bags.fm
  export SOLANA_PRIVATE_KEY="your-key"     # For signing txs

**Examples:**
  /bags quote 1 SOL to USDC
  /bags swap 0.5 SOL to BONK
  /bags launch "Moon Token" MOON "To the moon!" --twitter moontoken
  /bags fee-config <mint> wallet1:5000 wallet2:5000`;
  }
}

export default {
  name: 'bags',
  description: 'Bags.fm - Solana token launchpad and trading platform with creator monetization',
  commands: ['/bags'],
  handle: execute,
};
