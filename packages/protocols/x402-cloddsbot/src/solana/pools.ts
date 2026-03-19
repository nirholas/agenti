import { Connection } from '@solana/web3.js';
import { listMeteoraDlmmPools, MeteoraDlmmPoolInfo } from './meteora';
import { listRaydiumPools, RaydiumPoolInfo } from './raydium';
import { listOrcaWhirlpoolPools, OrcaWhirlpoolPoolInfo } from './orca';
import { resolveTokenMints } from './tokenlist';

export type DexName = 'meteora' | 'raydium' | 'orca';

export interface UnifiedPoolInfo {
  dex: DexName;
  address: string;
  tokenMintA: string;
  tokenMintB: string;
  liquidity?: number;
  volume24h?: number;
  stable?: boolean;
  price?: number;
  raw?: unknown;
}

export interface PoolSearchOptions {
  tokenMints?: string[];
  tokenSymbols?: string[];
  limit?: number;
  sortBy?: 'liquidity' | 'volume24h';
  preferredDexes?: DexName[];
}

export async function listAllPools(
  connection: Connection,
  options: PoolSearchOptions
): Promise<UnifiedPoolInfo[]> {
  const resolvedMints = options.tokenMints && options.tokenMints.length > 0
    ? options.tokenMints
    : options.tokenSymbols && options.tokenSymbols.length > 0
      ? await resolveTokenMints(options.tokenSymbols)
      : [];

  const tokenMints = resolvedMints.length > 0 ? resolvedMints : undefined;
  const limit = options.limit ?? 50;

  const [meteora, raydium, orca] = await Promise.all([
    listMeteoraDlmmPools(connection, { tokenMints, limit, includeLiquidity: true }),
    listRaydiumPools({ tokenMints, limit }),
    listOrcaWhirlpoolPools({ tokenMints, limit }),
  ]);

  const pools: UnifiedPoolInfo[] = [
    ...meteora.map((pool) => toUnifiedPool('meteora', pool)),
    ...raydium.map((pool) => toUnifiedPool('raydium', pool)),
    ...orca.map((pool) => toUnifiedPool('orca', pool)),
  ];

  const preferred = options.preferredDexes?.length ? options.preferredDexes : undefined;
  const filtered = preferred
    ? pools.filter((pool) => preferred.includes(pool.dex))
    : pools;

  return sortPools(filtered, options.sortBy ?? 'liquidity').slice(0, limit);
}

export async function selectBestPool(
  connection: Connection,
  options: PoolSearchOptions
): Promise<UnifiedPoolInfo | null> {
  const pools = await listAllPools(connection, options);
  return pools[0] || null;
}

export async function selectBestPoolWithResolvedMints(
  connection: Connection,
  options: PoolSearchOptions
): Promise<{ pool: UnifiedPoolInfo | null; tokenMints: string[] }> {
  const resolvedMints = options.tokenMints && options.tokenMints.length > 0
    ? options.tokenMints
    : options.tokenSymbols && options.tokenSymbols.length > 0
      ? await resolveTokenMints(options.tokenSymbols)
      : [];

  const pool = await selectBestPool(connection, {
    ...options,
    tokenMints: resolvedMints,
    tokenSymbols: undefined,
  });

  return { pool, tokenMints: resolvedMints };
}

function toUnifiedPool(dex: DexName, pool: MeteoraDlmmPoolInfo | RaydiumPoolInfo | OrcaWhirlpoolPoolInfo): UnifiedPoolInfo {
  if (dex === 'meteora') {
    const p = pool as MeteoraDlmmPoolInfo;
    return {
      dex,
      address: p.address,
      tokenMintA: p.tokenXMint,
      tokenMintB: p.tokenYMint,
      liquidity: p.liquidity,
      raw: p,
    };
  }
  if (dex === 'raydium') {
    const p = pool as RaydiumPoolInfo;
    return {
      dex,
      address: p.id || '',
      tokenMintA: p.baseMint,
      tokenMintB: p.quoteMint,
      liquidity: p.liquidity,
      volume24h: p.volume24h,
      raw: p,
    };
  }
  const p = pool as OrcaWhirlpoolPoolInfo;
  return {
    dex,
    address: p.address,
    tokenMintA: p.tokenMintA,
    tokenMintB: p.tokenMintB,
    liquidity: p.tvl,
    volume24h: p.volume24h,
    stable: p.stable,
    price: p.price,
    raw: p,
  };
}

function sortPools(pools: UnifiedPoolInfo[], sortBy: 'liquidity' | 'volume24h'): UnifiedPoolInfo[] {
  const key = sortBy === 'volume24h' ? 'volume24h' : 'liquidity';
  return pools.slice().sort((a, b) => {
    const aValue = a[key] ?? 0;
    const bValue = b[key] ?? 0;
    return bValue - aValue;
  });
}
