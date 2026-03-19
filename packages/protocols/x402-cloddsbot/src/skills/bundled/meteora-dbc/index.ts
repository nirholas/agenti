/**
 * Meteora DBC (Dynamic Bonding Curve) CLI Skill
 *
 * Launch tokens on Meteora's bonding curves with configurable market cap,
 * anti-sniper fees, LP distribution, and fee claiming.
 *
 * Commands:
 *
 * LAUNCH:
 * /dbc launch <name> <symbol> <desc> [options]  Launch token on Meteora DBC
 *
 * POOL STATUS:
 * /dbc status <mint>                             Check pool status + migration progress
 *
 * TRADING:
 * /dbc buy <mint> <amountSOL>                    Buy tokens on bonding curve
 * /dbc sell <mint> <amountTokens>                Sell tokens back to curve
 * /dbc quote <mint> <amount> [--sell]            Get swap quote
 *
 * FEE CLAIMING:
 * /dbc claim <pool> [--partner]                  Claim creator/partner trading fees
 *
 * INFO:
 * /dbc help                                      Show all commands
 */

const getSolanaModules = async () => {
  const [wallet, dbc] = await Promise.all([
    import('../../../solana/wallet.js'),
    import('../../../solana/meteora-dbc.js'),
  ]);
  return { wallet, dbc };
};

function isConfigured(): boolean {
  return !!(process.env.SOLANA_PRIVATE_KEY || process.env.SOLANA_KEYPAIR_PATH);
}

const KNOWN_STABLECOIN_MINTS: Record<string, number> = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6, // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 6, // USDT
};

function getTokenDecimals(mint: string): number {
  return KNOWN_STABLECOIN_MINTS[mint] ?? 9;
}

// ============================================================================
// Flag parsing helper
// ============================================================================

function parseFlag(args: string[], flag: string): string | undefined {
  const idx = args.findIndex(a => a === flag);
  if (idx >= 0 && args[idx + 1]) {
    return args[idx + 1];
  }
  return undefined;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

// ============================================================================
// Launch Handler
// ============================================================================

async function handleLaunch(args: string[]): Promise<string> {
  if (!isConfigured()) {
    return 'DBC not configured. Set SOLANA_PRIVATE_KEY or SOLANA_KEYPAIR_PATH.';
  }

  if (args.length < 3) {
    return `Usage: /dbc launch <name> <symbol> <description> [options]

Options:
  --mcap <SOL>           Initial market cap in SOL (default: 30)
  --grad <SOL>           Graduation market cap in SOL (default: 500)
  --supply <n>           Total supply (default: 1000000000)
  --decimals <n>         Token decimals 6-9 (default: 6)
  --fee-start <bps>      Starting fee bps (default: 500 = 5%)
  --fee-end <bps>        Ending fee bps (default: 100 = 1%)
  --fee-decay <sec>      Fee decay duration in seconds (default: 3600)
  --migration <0|1>      DAMM v1 (0) or v2 (1) (default: 1)
  --metadata-uri <url>   Pre-uploaded metadata URI
  --initial <SOL>        Initial buy after launch (SOL amount)
  --creator-fee <pct>    Creator trading fee % (default: 80)
  --dry-run              Simulate without executing

Example:
  /dbc launch "My Token" MTK "A great token" --mcap 50 --grad 800 --initial 0.5`;
  }

  const name = args[0];
  const symbol = args[1];
  const description = args[2];

  const mcap = parseFloat(parseFlag(args, '--mcap') || '30');
  const grad = parseFloat(parseFlag(args, '--grad') || '500');
  const supply = parseInt(parseFlag(args, '--supply') || '1000000000', 10);
  const decimals = parseInt(parseFlag(args, '--decimals') || '6', 10);
  const feeStart = parseInt(parseFlag(args, '--fee-start') || '500', 10);
  const feeEnd = parseInt(parseFlag(args, '--fee-end') || '100', 10);
  const feeDecay = parseInt(parseFlag(args, '--fee-decay') || '3600', 10);
  const migration = parseInt(parseFlag(args, '--migration') || '1', 10);
  const metadataUri = parseFlag(args, '--metadata-uri');
  const initialBuy = parseFlag(args, '--initial');
  const creatorFee = parseInt(parseFlag(args, '--creator-fee') || '80', 10);
  const dryRun = hasFlag(args, '--dry-run');

  if (dryRun) {
    return `**DBC Launch Preview (Dry Run)**

Name: ${name}
Symbol: ${symbol}
Description: ${description}
Total Supply: ${supply.toLocaleString()}
Decimals: ${decimals}
Initial Market Cap: ${mcap} SOL
Graduation Market Cap: ${grad} SOL
Starting Fee: ${(feeStart / 100).toFixed(1)}%
Ending Fee: ${(feeEnd / 100).toFixed(1)}%
Fee Decay: ${feeDecay}s
Migration: DAMM v${migration === 0 ? '1' : '2'}
Creator Trading Fee: ${creatorFee}%
${metadataUri ? `Metadata URI: ${metadataUri}` : 'Metadata URI: (none - provide with --metadata-uri)'}
${initialBuy ? `Initial Buy: ${initialBuy} SOL` : 'Initial Buy: none'}

LP Distribution:
  Partner Locked: 50%
  Creator Locked: 45%
  Creator Liquid: 5%

**No transaction sent (dry run).**`;
  }

  if (!metadataUri) {
    return 'Error: --metadata-uri is required. Upload your token metadata JSON to IPFS first, then provide the URI.';
  }

  try {
    const { wallet, dbc } = await getSolanaModules();
    const keypair = wallet.loadSolanaKeypair();
    const connection = wallet.getSolanaConnection();

    const config = {
      initialMarketCap: mcap,
      migrationMarketCap: grad,
      totalTokenSupply: supply,
      tokenDecimals: decimals,
      startingFeeBps: feeStart,
      endingFeeBps: feeEnd,
      feeDecayDurationSec: feeDecay,
      migrationOption: migration,
      creatorTradingFeePercent: creatorFee,
      dynamicFeeEnabled: true,
    };

    if (initialBuy) {
      const buyLamports = dbc.toLamports(initialBuy, 9).toString();
      const result = await dbc.createDbcPoolWithFirstBuy(connection, keypair, {
        name,
        symbol,
        uri: metadataUri,
        config,
        buyAmountLamports: buyLamports,
      });

      return `**Token Launched on Meteora DBC!**

Name: ${name}
Symbol: ${symbol}
Mint: \`${result.baseMint}\`
Pool: \`${result.poolAddress}\`
Config: \`${result.configAddress}\`
Initial Buy: ${initialBuy} SOL

Transactions:
${result.signatures.map((s, i) => `  ${i + 1}. \`${s}\``).join('\n')}

Explorer: https://solscan.io/token/${result.baseMint}`;
    }

    const result = await dbc.createDbcPool(connection, keypair, {
      name,
      symbol,
      uri: metadataUri,
      config,
    });

    return `**Token Launched on Meteora DBC!**

Name: ${name}
Symbol: ${symbol}
Mint: \`${result.baseMint}\`
Pool: \`${result.poolAddress}\`
Config: \`${result.configAddress}\`
TX: \`${result.signature}\`

Explorer: https://solscan.io/token/${result.baseMint}`;
  } catch (error) {
    return `Launch failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ============================================================================
// Status Handler
// ============================================================================

async function handleStatus(mint: string): Promise<string> {
  if (!mint) {
    return 'Usage: /dbc status <mint>';
  }

  try {
    const { wallet, dbc } = await getSolanaModules();
    const connection = wallet.getSolanaConnection();

    const status = await dbc.getDbcPoolStatus(connection, mint);

    if (!status.found) {
      return `No DBC pool found for mint \`${mint}\``;
    }

    let output = `**DBC Pool Status**

Mint: \`${mint}\`
Pool: \`${status.poolAddress}\`
Config: \`${status.configAddress}\`
Creator: \`${status.creator}\`
Migrated: ${status.isMigrated ? 'Yes' : 'No'}

**Bonding Curve:**
  Quote Reserve: ${(Number(status.quoteReserve) / 1e9).toFixed(4)} SOL
  Migration Threshold: ${(Number(status.migrationThreshold) / 1e9).toFixed(4)} SOL
  Progress: ${status.progressPercent}%`;

    if (status.fees) {
      output += `

**Unclaimed Fees:**
  Creator Base: ${status.fees.creatorBase}
  Creator Quote: ${(Number(status.fees.creatorQuote) / 1e9).toFixed(6)} SOL
  Partner Base: ${status.fees.partnerBase}
  Partner Quote: ${(Number(status.fees.partnerQuote) / 1e9).toFixed(6)} SOL`;
    }

    return output;
  } catch (error) {
    return `Status check failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ============================================================================
// Buy Handler
// ============================================================================

async function handleBuy(args: string[]): Promise<string> {
  if (!isConfigured()) {
    return 'DBC not configured. Set SOLANA_PRIVATE_KEY.';
  }

  if (args.length < 2) {
    return 'Usage: /dbc buy <mint> <amountSOL>';
  }

  const mint = args[0];
  const amountSol = args[1];

  try {
    const { wallet, dbc } = await getSolanaModules();
    const keypair = wallet.loadSolanaKeypair();
    const connection = wallet.getSolanaConnection();

    // Lookup pool by mint
    const status = await dbc.getDbcPoolStatus(connection, mint);
    if (!status.found) {
      return `No DBC pool found for mint \`${mint}\``;
    }

    if (status.isMigrated) {
      return `Pool has already migrated to DAMM. Use /met swap instead.`;
    }

    const amountLamports = dbc.toLamports(amountSol, 9).toString();

    const result = await dbc.swapOnDbcPool(connection, keypair, {
      poolAddress: status.poolAddress,
      amountIn: amountLamports,
      swapBaseForQuote: false, // BUY = quote->base
    });

    return `**DBC Buy Complete**

Mint: \`${mint.slice(0, 20)}...\`
Amount: ${amountSol} SOL
Direction: ${result.direction}
TX: \`${result.signature}\``;
  } catch (error) {
    return `Buy failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ============================================================================
// Sell Handler
// ============================================================================

async function handleSell(args: string[]): Promise<string> {
  if (!isConfigured()) {
    return 'DBC not configured. Set SOLANA_PRIVATE_KEY.';
  }

  if (args.length < 2) {
    return 'Usage: /dbc sell <mint> <amountTokens>';
  }

  const mint = args[0];
  const amountTokens = args[1];

  try {
    const { wallet, dbc } = await getSolanaModules();
    const keypair = wallet.loadSolanaKeypair();
    const connection = wallet.getSolanaConnection();

    const status = await dbc.getDbcPoolStatus(connection, mint);
    if (!status.found) {
      return `No DBC pool found for mint \`${mint}\``;
    }

    if (status.isMigrated) {
      return `Pool has already migrated to DAMM. Use /met swap instead.`;
    }

    const tokenDecimals = getTokenDecimals(mint);
    const amountLamports = dbc.toLamports(amountTokens, tokenDecimals).toString();

    const result = await dbc.swapOnDbcPool(connection, keypair, {
      poolAddress: status.poolAddress,
      amountIn: amountLamports,
      swapBaseForQuote: true, // SELL = base->quote
    });

    return `**DBC Sell Complete**

Mint: \`${mint.slice(0, 20)}...\`
Amount: ${amountTokens} tokens
Direction: ${result.direction}
TX: \`${result.signature}\``;
  } catch (error) {
    return `Sell failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ============================================================================
// Quote Handler
// ============================================================================

async function handleQuote(args: string[]): Promise<string> {
  if (args.length < 2) {
    return 'Usage: /dbc quote <mint> <amount> [--sell]';
  }

  const mint = args[0];
  const amount = args[1];
  const isSell = hasFlag(args, '--sell');

  try {
    const { wallet, dbc } = await getSolanaModules();
    const connection = wallet.getSolanaConnection();

    const status = await dbc.getDbcPoolStatus(connection, mint);
    if (!status.found) {
      return `No DBC pool found for mint \`${mint}\``;
    }

    if (status.isMigrated) {
      return `Pool has migrated. Use /met quote instead.`;
    }

    // For buy: amount is SOL (9 decimals), for sell: amount is tokens (variable decimals)
    const tokenDecimals = getTokenDecimals(mint);
    const decimals = isSell ? tokenDecimals : 9;
    const amountLamports = dbc.toLamports(amount, decimals).toString();

    const quote = await dbc.getDbcSwapQuote(connection, {
      poolAddress: status.poolAddress,
      amountIn: amountLamports,
      swapBaseForQuote: isSell,
    });

    const outDecimals = isSell ? 9 : tokenDecimals;
    const outAmount = Number(quote.amountOut) / Math.pow(10, outDecimals);
    const minOut = Number(quote.minimumAmountOut) / Math.pow(10, outDecimals);
    const unit = isSell ? 'SOL' : 'tokens';

    return `**DBC Quote**

Mint: \`${mint.slice(0, 20)}...\`
${isSell ? `Sell: ${amount} tokens` : `Buy: ${amount} SOL`}
Output: ${outAmount.toFixed(outDecimals === 9 ? 6 : 2)} ${unit}
Min Output: ${minOut.toFixed(outDecimals === 9 ? 6 : 2)} ${unit}
Direction: ${quote.direction}`;
  } catch (error) {
    return `Quote failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ============================================================================
// Claim Handler
// ============================================================================

async function handleClaim(args: string[]): Promise<string> {
  if (!isConfigured()) {
    return 'DBC not configured. Set SOLANA_PRIVATE_KEY.';
  }

  if (args.length < 1) {
    return 'Usage: /dbc claim <pool> [--partner]';
  }

  const poolAddress = args[0];
  const isPartner = hasFlag(args, '--partner');

  try {
    const { wallet, dbc } = await getSolanaModules();
    const keypair = wallet.loadSolanaKeypair();
    const connection = wallet.getSolanaConnection();

    if (isPartner) {
      const result = await dbc.claimDbcPartnerFees(connection, keypair, poolAddress);
      return `**Partner Fees Claimed**

Pool: \`${poolAddress.slice(0, 20)}...\`
TX: \`${result.signature}\``;
    }

    const result = await dbc.claimDbcCreatorFees(connection, keypair, poolAddress);
    return `**Creator Fees Claimed**

Pool: \`${poolAddress.slice(0, 20)}...\`
TX: \`${result.signature}\``;
  } catch (error) {
    return `Claim failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ============================================================================
// Migrate Handler
// ============================================================================

async function handleMigrate(args: string[]): Promise<string> {
  if (!isConfigured()) {
    return 'DBC not configured. Set SOLANA_PRIVATE_KEY.';
  }

  const sub = args[0]?.toLowerCase();

  if (!sub || sub === 'help') {
    return `**DBC Migration Commands**

  /dbc migrate v1 <pool> <dammConfig>           Migrate pool to DAMM V1
  /dbc migrate v2 <pool> <dammConfig>           Migrate pool to DAMM V2
  /dbc migrate locker <pool>                     Create locker for locked vesting
  /dbc migrate lock-lp <pool> <dammConfig> [--partner]   Lock DAMM V1 LP token
  /dbc migrate claim-lp <pool> <dammConfig> [--partner]  Claim DAMM V1 LP token
  /dbc migrate leftover <pool>                   Withdraw leftover tokens
  /dbc migrate metadata <pool> <config>          Create DAMM V1 migration metadata
  /dbc migrate info <pool>                       Get migration metadata`;
  }

  try {
    const { wallet, dbc } = await getSolanaModules();
    const keypair = wallet.loadSolanaKeypair();
    const connection = wallet.getSolanaConnection();

    switch (sub) {
      case 'v1': {
        if (args.length < 3) return 'Usage: /dbc migrate v1 <pool> <dammConfig>';
        const result = await dbc.migrateToDammV1(connection, keypair, {
          poolAddress: args[1],
          dammConfig: args[2],
        });
        return `**Migrated to DAMM V1**\nPool: \`${args[1].slice(0, 20)}...\`\nTX: \`${result.signature}\``;
      }

      case 'v2': {
        if (args.length < 3) return 'Usage: /dbc migrate v2 <pool> <dammConfig>';
        const result = await dbc.migrateToDammV2(connection, keypair, {
          poolAddress: args[1],
          dammConfig: args[2],
        });
        return `**Migrated to DAMM V2**\nPool: \`${args[1].slice(0, 20)}...\`\nTX: \`${result.signature}\``;
      }

      case 'locker': {
        if (args.length < 2) return 'Usage: /dbc migrate locker <pool>';
        const result = await dbc.createDbcLocker(connection, keypair, args[1]);
        return `**Locker Created**\nPool: \`${args[1].slice(0, 20)}...\`\nTX: \`${result.signature}\``;
      }

      case 'lock-lp': {
        if (args.length < 3) return 'Usage: /dbc migrate lock-lp <pool> <dammConfig> [--partner]';
        const result = await dbc.lockDammV1LpToken(connection, keypair, {
          poolAddress: args[1],
          dammConfig: args[2],
          isPartner: hasFlag(args, '--partner'),
        });
        return `**LP Token Locked**\nPool: \`${args[1].slice(0, 20)}...\`\nTX: \`${result.signature}\``;
      }

      case 'claim-lp': {
        if (args.length < 3) return 'Usage: /dbc migrate claim-lp <pool> <dammConfig> [--partner]';
        const result = await dbc.claimDammV1LpToken(connection, keypair, {
          poolAddress: args[1],
          dammConfig: args[2],
          isPartner: hasFlag(args, '--partner'),
        });
        return `**LP Token Claimed**\nPool: \`${args[1].slice(0, 20)}...\`\nTX: \`${result.signature}\``;
      }

      case 'leftover': {
        if (args.length < 2) return 'Usage: /dbc migrate leftover <pool>';
        const result = await dbc.withdrawLeftover(connection, keypair, args[1]);
        return `**Leftover Withdrawn**\nPool: \`${args[1].slice(0, 20)}...\`\nTX: \`${result.signature}\``;
      }

      case 'metadata': {
        if (args.length < 3) return 'Usage: /dbc migrate metadata <pool> <config>';
        const result = await dbc.createDammV1MigrationMetadata(connection, keypair, {
          poolAddress: args[1],
          config: args[2],
        });
        return `**Migration Metadata Created**\nPool: \`${args[1].slice(0, 20)}...\`\nTX: \`${result.signature}\``;
      }

      case 'info': {
        if (args.length < 2) return 'Usage: /dbc migrate info <pool>';
        const meta = await dbc.getDbcMigrationMetadata(connection, args[1]);
        return `**Migration Metadata**\nPool: \`${args[1].slice(0, 20)}...\`\n\`\`\`json\n${JSON.stringify(meta, null, 2)}\n\`\`\``;
      }

      default:
        return `Unknown migration command: ${sub}. Try /dbc migrate help`;
    }
  } catch (error) {
    return `Migration failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ============================================================================
// Swap V2 Handler
// ============================================================================

async function handleSwap2(args: string[]): Promise<string> {
  if (!isConfigured()) {
    return 'DBC not configured. Set SOLANA_PRIVATE_KEY.';
  }

  if (args.length < 3) {
    return `Usage: /dbc swap2 <mint> <amount> <mode> [options]

Modes:
  exact-in     Exact input amount (default)
  partial      Partial fill
  exact-out    Exact output amount

Options:
  --sell                  Sell (base->quote) instead of buy
  --min-out <amount>      Minimum output (for exact-in/partial)
  --max-in <amount>       Maximum input (for exact-out)

Examples:
  /dbc swap2 <mint> 1 exact-in              Buy with 1 SOL exact input
  /dbc swap2 <mint> 1000 exact-out --sell   Sell to get exactly 1000 tokens out
  /dbc swap2 <mint> 0.5 partial             Partial fill buy with 0.5 SOL`;
  }

  const mint = args[0];
  const amount = args[1];
  const mode = args[2]?.toLowerCase() || 'exact-in';
  const isSell = hasFlag(args, '--sell');

  try {
    const { wallet, dbc } = await getSolanaModules();
    const keypair = wallet.loadSolanaKeypair();
    const connection = wallet.getSolanaConnection();

    const status = await dbc.getDbcPoolStatus(connection, mint);
    if (!status.found) return `No DBC pool found for mint \`${mint}\``;
    if (status.isMigrated) return `Pool has migrated. Use /met swap instead.`;

    let swapMode = 0;
    if (mode === 'partial') swapMode = 1;
    else if (mode === 'exact-out') swapMode = 2;

    const params: any = {
      poolAddress: status.poolAddress,
      swapBaseForQuote: isSell,
      swapMode,
    };

    const tokenDecimals = getTokenDecimals(mint);
    if (swapMode === 2) {
      const decimals = isSell ? 9 : tokenDecimals;
      params.amountOut = dbc.toLamports(amount, decimals).toString();
      const maxIn = parseFlag(args, '--max-in');
      if (maxIn) {
        const maxDecimals = isSell ? tokenDecimals : 9;
        params.maximumAmountIn = dbc.toLamports(maxIn, maxDecimals).toString();
      }
    } else {
      const decimals = isSell ? tokenDecimals : 9;
      params.amountIn = dbc.toLamports(amount, decimals).toString();
      const minOut = parseFlag(args, '--min-out');
      if (minOut) {
        const minDecimals = isSell ? 9 : tokenDecimals;
        params.minimumAmountOut = dbc.toLamports(minOut, minDecimals).toString();
      }
    }

    const result = await dbc.swapOnDbcPoolV2(connection, keypair, params);
    return `**DBC Swap V2 Complete**\nMode: ${mode}\nDirection: ${result.direction}\nTX: \`${result.signature}\``;
  } catch (error) {
    return `Swap V2 failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ============================================================================
// Fees Handler (detailed breakdown)
// ============================================================================

async function handleFees(args: string[]): Promise<string> {
  if (args.length < 1) {
    return `Usage:
  /dbc fees <pool>                    Detailed fee breakdown for a pool
  /dbc fees by-config <config>        All pool fees for a config
  /dbc fees by-creator <address>      All pool fees for a creator`;
  }

  try {
    const { wallet, dbc } = await getSolanaModules();
    const connection = wallet.getSolanaConnection();

    const sub = args[0]?.toLowerCase();

    if (sub === 'by-config' && args[1]) {
      const fees = await dbc.getDbcPoolsFeesByConfig(connection, args[1]);
      if (fees.length === 0) return 'No pools found for this config.';
      let output = `**Fees for Config \`${args[1].slice(0, 20)}...\`** (${fees.length} pools)\n`;
      for (const f of fees.slice(0, 20)) {
        output += `\nPool: \`${f.poolAddress.slice(0, 16)}...\``;
        output += `\n  Creator: ${f.creatorBase} base / ${f.creatorQuote} quote`;
        output += `\n  Partner: ${f.partnerBase} base / ${f.partnerQuote} quote`;
      }
      if (fees.length > 20) output += `\n\n...and ${fees.length - 20} more pools`;
      return output;
    }

    if (sub === 'by-creator' && args[1]) {
      const fees = await dbc.getDbcPoolsFeesByCreator(connection, args[1]);
      if (fees.length === 0) return 'No pools found for this creator.';
      let output = `**Fees for Creator \`${args[1].slice(0, 20)}...\`** (${fees.length} pools)\n`;
      for (const f of fees.slice(0, 20)) {
        output += `\nPool: \`${f.poolAddress.slice(0, 16)}...\``;
        output += `\n  Creator: ${f.creatorBase} base / ${f.creatorQuote} quote`;
        output += `\n  Partner: ${f.partnerBase} base / ${f.partnerQuote} quote`;
      }
      if (fees.length > 20) output += `\n\n...and ${fees.length - 20} more pools`;
      return output;
    }

    // Default: single pool fee breakdown
    const breakdown = await dbc.getDbcPoolFeeBreakdown(connection, args[0]);
    return `**Fee Breakdown for Pool \`${args[0].slice(0, 20)}...\`**

**Creator Fees:**
  Unclaimed: ${breakdown.creator.unclaimedBase} base / ${breakdown.creator.unclaimedQuote} quote
  Claimed: ${breakdown.creator.claimedBase} base / ${breakdown.creator.claimedQuote} quote
  Total: ${breakdown.creator.totalBase} base / ${breakdown.creator.totalQuote} quote

**Partner Fees:**
  Unclaimed: ${breakdown.partner.unclaimedBase} base / ${breakdown.partner.unclaimedQuote} quote
  Claimed: ${breakdown.partner.claimedBase} base / ${breakdown.partner.claimedQuote} quote
  Total: ${breakdown.partner.totalBase} base / ${breakdown.partner.totalQuote} quote`;
  } catch (error) {
    return `Fees query failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ============================================================================
// Pools Handler (list/query pools)
// ============================================================================

async function handlePools(args: string[]): Promise<string> {
  const sub = args[0]?.toLowerCase();

  if (!sub || sub === 'help') {
    return `Usage:
  /dbc pools by-config <config>       List pools for a config
  /dbc pools by-creator <address>     List pools by creator
  /dbc pools configs [owner]          List configs (optionally by owner)
  /dbc pools metadata <pool>          Get pool metadata
  /dbc pools partner-meta <address>   Get partner metadata
  /dbc pools escrow <escrowAddress>   Get DAMM V1 lock escrow`;
  }

  try {
    const { wallet, dbc } = await getSolanaModules();
    const connection = wallet.getSolanaConnection();

    switch (sub) {
      case 'by-config': {
        if (!args[1]) return 'Usage: /dbc pools by-config <config>';
        const pools = await dbc.getDbcPoolsByConfig(connection, args[1]);
        if (pools.length === 0) return 'No pools found for this config.';
        let output = `**Pools for Config \`${args[1].slice(0, 20)}...\`** (${pools.length} pools)\n`;
        for (const p of pools.slice(0, 30)) {
          const isMig = (p.pool as any).migrated ? ' [MIGRATED]' : '';
          output += `\n  \`${p.address}\`${isMig}`;
        }
        if (pools.length > 30) output += `\n\n...and ${pools.length - 30} more`;
        return output;
      }

      case 'by-creator': {
        if (!args[1]) return 'Usage: /dbc pools by-creator <address>';
        const pools = await dbc.getDbcPoolsByCreator(connection, args[1]);
        if (pools.length === 0) return 'No pools found for this creator.';
        let output = `**Pools by Creator \`${args[1].slice(0, 20)}...\`** (${pools.length} pools)\n`;
        for (const p of pools.slice(0, 30)) {
          const isMig = (p.pool as any).migrated ? ' [MIGRATED]' : '';
          output += `\n  \`${p.address}\`${isMig}`;
        }
        if (pools.length > 30) output += `\n\n...and ${pools.length - 30} more`;
        return output;
      }

      case 'configs': {
        if (args[1]) {
          const configs = await dbc.getDbcPoolConfigsByOwner(connection, args[1]);
          if (configs.length === 0) return 'No configs found for this owner.';
          let output = `**Configs by Owner \`${args[1].slice(0, 20)}...\`** (${configs.length})\n`;
          for (const c of configs.slice(0, 30)) {
            output += `\n  \`${c.address}\``;
          }
          return output;
        }
        const configs = await dbc.getDbcPoolConfigs(connection);
        return `**All DBC Configs** (${configs.length} total)\n\nUse \`/dbc pools configs <owner>\` to filter by owner.`;
      }

      case 'metadata': {
        if (!args[1]) return 'Usage: /dbc pools metadata <pool>';
        const meta = await dbc.getDbcPoolMetadata(connection, args[1]);
        if (!meta || meta.length === 0) return 'No metadata found for this pool.';
        return `**Pool Metadata**\n\`\`\`json\n${JSON.stringify(meta, null, 2)}\n\`\`\``;
      }

      case 'partner-meta': {
        if (!args[1]) return 'Usage: /dbc pools partner-meta <address>';
        const meta = await dbc.getDbcPartnerMetadata(connection, args[1]);
        if (!meta || meta.length === 0) return 'No partner metadata found.';
        return `**Partner Metadata**\n\`\`\`json\n${JSON.stringify(meta, null, 2)}\n\`\`\``;
      }

      case 'escrow': {
        if (!args[1]) return 'Usage: /dbc pools escrow <escrowAddress>';
        const escrow = await dbc.getDbcLockEscrow(connection, args[1]);
        if (!escrow) return 'Lock escrow not found.';
        return `**Lock Escrow**\n\`\`\`json\n${JSON.stringify(escrow, null, 2)}\n\`\`\``;
      }

      default:
        return `Unknown pools command: ${sub}. Try /dbc pools help`;
    }
  } catch (error) {
    return `Pools query failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ============================================================================
// Partner Handler
// ============================================================================

async function handlePartner(args: string[]): Promise<string> {
  if (!isConfigured()) {
    return 'DBC not configured. Set SOLANA_PRIVATE_KEY.';
  }

  const sub = args[0]?.toLowerCase();

  if (!sub || sub === 'help') {
    return `**DBC Partner Commands**

  /dbc partner metadata <name> <website> <logo>       Create partner metadata
  /dbc partner surplus <pool>                          Withdraw partner surplus
  /dbc partner migration-fee <pool>                    Withdraw partner migration fee
  /dbc partner creation-fee <pool> [--receiver <addr>] Claim pool creation fee
  /dbc partner claim2 <pool> <receiver>                Claim trading fee V2`;
  }

  try {
    const { wallet, dbc } = await getSolanaModules();
    const keypair = wallet.loadSolanaKeypair();
    const connection = wallet.getSolanaConnection();

    switch (sub) {
      case 'metadata': {
        if (args.length < 4) return 'Usage: /dbc partner metadata <name> <website> <logo>';
        const result = await dbc.createPartnerMetadata(connection, keypair, {
          name: args[1],
          website: args[2],
          logo: args[3],
        });
        return `**Partner Metadata Created**\nTX: \`${result.signature}\``;
      }

      case 'surplus': {
        if (!args[1]) return 'Usage: /dbc partner surplus <pool>';
        const result = await dbc.partnerWithdrawSurplus(connection, keypair, args[1]);
        return `**Partner Surplus Withdrawn**\nPool: \`${args[1].slice(0, 20)}...\`\nTX: \`${result.signature}\``;
      }

      case 'migration-fee': {
        if (!args[1]) return 'Usage: /dbc partner migration-fee <pool>';
        const result = await dbc.partnerWithdrawMigrationFee(connection, keypair, args[1]);
        return `**Partner Migration Fee Withdrawn**\nPool: \`${args[1].slice(0, 20)}...\`\nTX: \`${result.signature}\``;
      }

      case 'creation-fee': {
        if (!args[1]) return 'Usage: /dbc partner creation-fee <pool> [--receiver <addr>]';
        const receiver = parseFlag(args, '--receiver') || keypair.publicKey.toBase58();
        const result = await dbc.claimPartnerPoolCreationFee(connection, keypair, {
          poolAddress: args[1],
          feeReceiver: receiver,
        });
        return `**Partner Pool Creation Fee Claimed**\nPool: \`${args[1].slice(0, 20)}...\`\nTX: \`${result.signature}\``;
      }

      case 'claim2': {
        if (args.length < 3) return 'Usage: /dbc partner claim2 <pool> <receiver>';
        const result = await dbc.claimDbcPartnerFeesV2(connection, keypair, {
          poolAddress: args[1],
          receiver: args[2],
        });
        return `**Partner Trading Fee V2 Claimed**\nPool: \`${args[1].slice(0, 20)}...\`\nTX: \`${result.signature}\``;
      }

      default:
        return `Unknown partner command: ${sub}. Try /dbc partner help`;
    }
  } catch (error) {
    return `Partner operation failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ============================================================================
// Creator Handler
// ============================================================================

async function handleCreator(args: string[]): Promise<string> {
  if (!isConfigured()) {
    return 'DBC not configured. Set SOLANA_PRIVATE_KEY.';
  }

  const sub = args[0]?.toLowerCase();

  if (!sub || sub === 'help') {
    return `**DBC Creator Commands**

  /dbc creator metadata <pool> <name> <website> <logo>  Create pool metadata
  /dbc creator surplus <pool>                            Withdraw creator surplus
  /dbc creator migration-fee <pool>                      Withdraw creator migration fee
  /dbc creator transfer <pool> <newCreator>              Transfer pool creator
  /dbc creator claim2 <pool> <receiver>                  Claim trading fee V2`;
  }

  try {
    const { wallet, dbc } = await getSolanaModules();
    const keypair = wallet.loadSolanaKeypair();
    const connection = wallet.getSolanaConnection();

    switch (sub) {
      case 'metadata': {
        if (args.length < 5) return 'Usage: /dbc creator metadata <pool> <name> <website> <logo>';
        const result = await dbc.createPoolMetadata(connection, keypair, {
          poolAddress: args[1],
          name: args[2],
          website: args[3],
          logo: args[4],
        });
        return `**Pool Metadata Created**\nPool: \`${args[1].slice(0, 20)}...\`\nTX: \`${result.signature}\``;
      }

      case 'surplus': {
        if (!args[1]) return 'Usage: /dbc creator surplus <pool>';
        const result = await dbc.creatorWithdrawSurplus(connection, keypair, args[1]);
        return `**Creator Surplus Withdrawn**\nPool: \`${args[1].slice(0, 20)}...\`\nTX: \`${result.signature}\``;
      }

      case 'migration-fee': {
        if (!args[1]) return 'Usage: /dbc creator migration-fee <pool>';
        const result = await dbc.creatorWithdrawMigrationFee(connection, keypair, args[1]);
        return `**Creator Migration Fee Withdrawn**\nPool: \`${args[1].slice(0, 20)}...\`\nTX: \`${result.signature}\``;
      }

      case 'transfer': {
        if (args.length < 3) return 'Usage: /dbc creator transfer <pool> <newCreator>';
        const result = await dbc.transferPoolCreator(connection, keypair, {
          poolAddress: args[1],
          newCreator: args[2],
        });
        return `**Pool Creator Transferred**\nPool: \`${args[1].slice(0, 20)}...\`\nNew Creator: \`${args[2].slice(0, 20)}...\`\nTX: \`${result.signature}\``;
      }

      case 'claim2': {
        if (args.length < 3) return 'Usage: /dbc creator claim2 <pool> <receiver>';
        const result = await dbc.claimDbcCreatorFeesV2(connection, keypair, {
          poolAddress: args[1],
          receiver: args[2],
        });
        return `**Creator Trading Fee V2 Claimed**\nPool: \`${args[1].slice(0, 20)}...\`\nTX: \`${result.signature}\``;
      }

      default:
        return `Unknown creator command: ${sub}. Try /dbc creator help`;
    }
  } catch (error) {
    return `Creator operation failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ============================================================================
// Main Execute
// ============================================================================

export async function execute(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const command = parts[0]?.toLowerCase() || 'help';
  const rest = parts.slice(1);

  switch (command) {
    case 'launch':
      return handleLaunch(rest);
    case 'status':
      return handleStatus(rest[0]);
    case 'buy':
      return handleBuy(rest);
    case 'sell':
      return handleSell(rest);
    case 'quote':
      return handleQuote(rest);
    case 'claim':
      return handleClaim(rest);
    case 'migrate':
      return handleMigrate(rest);
    case 'swap2':
      return handleSwap2(rest);
    case 'fees':
      return handleFees(rest);
    case 'pools':
      return handlePools(rest);
    case 'partner':
      return handlePartner(rest);
    case 'creator':
      return handleCreator(rest);

    case 'help':
    default:
      return `**Meteora DBC - Dynamic Bonding Curve Token Launch**

**Launch:**
  /dbc launch <name> <symbol> <desc> [options]  Launch token
  /dbc launch ... --dry-run                      Preview without executing

**Pool Status:**
  /dbc status <mint>                             Check pool + migration progress

**Trading:**
  /dbc buy <mint> <amountSOL>                    Buy tokens on curve
  /dbc sell <mint> <amountTokens>                Sell tokens to curve
  /dbc quote <mint> <amount> [--sell]            Get swap quote
  /dbc swap2 <mint> <amount> <mode> [options]    Swap V2 (exact-in/partial/exact-out)

**Migration:**
  /dbc migrate v1 <pool> <dammConfig>            Migrate to DAMM V1
  /dbc migrate v2 <pool> <dammConfig>            Migrate to DAMM V2
  /dbc migrate locker <pool>                     Create locker
  /dbc migrate lock-lp <pool> <dammConfig>       Lock LP token
  /dbc migrate claim-lp <pool> <dammConfig>      Claim LP token
  /dbc migrate leftover <pool>                   Withdraw leftover
  /dbc migrate metadata <pool> <config>          Create migration metadata
  /dbc migrate info <pool>                       Get migration metadata

**Fee Management:**
  /dbc claim <pool> [--partner]                  Claim trading fees
  /dbc fees <pool>                               Detailed fee breakdown
  /dbc fees by-config <config>                   Fees for all pools in config
  /dbc fees by-creator <address>                 Fees for all creator pools

**Partner Operations:**
  /dbc partner metadata <name> <website> <logo>  Create partner metadata
  /dbc partner surplus <pool>                    Withdraw surplus
  /dbc partner migration-fee <pool>              Withdraw migration fee
  /dbc partner creation-fee <pool>               Claim creation fee
  /dbc partner claim2 <pool> <receiver>          Claim fee V2

**Creator Operations:**
  /dbc creator metadata <pool> <name> <website> <logo>  Create pool metadata
  /dbc creator surplus <pool>                    Withdraw surplus
  /dbc creator migration-fee <pool>              Withdraw migration fee
  /dbc creator transfer <pool> <newCreator>      Transfer ownership
  /dbc creator claim2 <pool> <receiver>          Claim fee V2

**Pool Queries:**
  /dbc pools by-config <config>                  List pools by config
  /dbc pools by-creator <address>                List pools by creator
  /dbc pools configs [owner]                     List configs
  /dbc pools metadata <pool>                     Pool metadata
  /dbc pools partner-meta <address>              Partner metadata
  /dbc pools escrow <escrow>                     Lock escrow details

**Launch Options:**
  --mcap <SOL>           Initial market cap (default: 30)
  --grad <SOL>           Graduation market cap (default: 500)
  --supply <n>           Total supply (default: 1B)
  --decimals <n>         Token decimals 6-9 (default: 6)
  --fee-start <bps>      Starting fee bps (default: 500 = 5%)
  --fee-end <bps>        Ending fee bps (default: 100 = 1%)
  --fee-decay <sec>      Fee decay duration (default: 3600)
  --migration <0|1>      DAMM v1 or v2 (default: 1)
  --metadata-uri <url>   Pre-uploaded metadata URI (required)
  --initial <SOL>        Initial buy after launch
  --creator-fee <pct>    Creator trading fee % (default: 80)

**Setup:**
  export SOLANA_PRIVATE_KEY="your-key"
  export SOLANA_RPC_URL="your-rpc"`;
  }
}

export default {
  name: 'meteora-dbc',
  description: 'Meteora DBC - launch tokens on dynamic bonding curves',
  commands: ['/dbc', '/meteora-dbc'],
  handle: execute,
};
