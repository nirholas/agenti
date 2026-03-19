import { Connection } from '@solana/web3.js';
import bs58 from 'bs58';
import { JsonRpcProvider } from 'ethers';
import {
  Wormhole,
  wormhole,
  TokenTransfer,
  CircleTransfer,
  chainToPlatform,
  toChain,
  type Chain,
  type Network,
  type TokenId,
} from '@wormhole-foundation/sdk';
import { circle } from '@wormhole-foundation/sdk-base';
import evm from '@wormhole-foundation/sdk/platforms/evm';
import solana from '@wormhole-foundation/sdk/platforms/solana';
import { getEvmSigner } from '@wormhole-foundation/sdk-evm';
import { getSolanaSigner } from '@wormhole-foundation/sdk-solana';
import { loadSolanaKeypair, decodeSecretKey } from '../solana/wallet';

export type WormholeProtocol = 'token_bridge' | 'cctp';

export interface WormholeQuoteRequest {
  network?: string;
  protocol?: WormholeProtocol;
  source_chain: string;
  destination_chain: string;
  source_address?: string;
  destination_address: string;
  token_address?: string;
  amount: string;
  amount_units?: 'human' | 'atomic';
  automatic?: boolean;
  payload_base64?: string;
  destination_native_gas?: string;
  destination_native_gas_units?: 'human' | 'atomic';
  source_rpc_url?: string;
  destination_rpc_url?: string;
}

export interface WormholeBridgeRequest extends WormholeQuoteRequest {
  attest_timeout_ms?: number;
  skip_redeem?: boolean;
}

export interface WormholeRedeemRequest {
  network?: string;
  protocol?: WormholeProtocol;
  source_chain: string;
  destination_chain: string;
  source_txid: string;
  attest_timeout_ms?: number;
  destination_rpc_url?: string;
  source_rpc_url?: string;
}

const DEFAULT_WORMHOLE_NETWORK: Network = 'Mainnet';

function normalizeNetwork(input?: string): Network {
  const raw = (input || process.env.WORMHOLE_NETWORK || DEFAULT_WORMHOLE_NETWORK).toString().trim();
  const lower = raw.toLowerCase();
  if (lower === 'mainnet') return 'Mainnet';
  if (lower === 'testnet') return 'Testnet';
  if (lower === 'devnet') return 'Devnet';
  return raw as Network;
}

function normalizeChain(input: string): Chain {
  const trimmed = input.trim();
  try {
    return toChain(trimmed);
  } catch {}
  throw new Error(`Unknown Wormhole chain: ${input}`);
}

function buildEnvKey(prefix: string, chain: Chain): string {
  const normalized = chain.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  return `${prefix}_${normalized}`;
}

function resolveRpcFromEnv(chain: Chain): string | undefined {
  const direct = process.env[buildEnvKey('WORMHOLE_RPC', chain)];
  if (direct) return direct;
  const platform = chainToPlatform(chain);
  if (platform === 'Solana') return process.env.SOLANA_RPC_URL;
  if (platform === 'Evm') return process.env.EVM_RPC_URL;
  return undefined;
}

function resolvePrivateKeyForChain(chain: Chain): string | undefined {
  const direct = process.env[buildEnvKey('WORMHOLE_PRIVATE_KEY', chain)];
  if (direct) return direct;
  const platform = chainToPlatform(chain);
  if (platform === 'Evm') return process.env.EVM_PRIVATE_KEY;
  return undefined;
}

function parseAmount(value: string, decimals: number, units: 'human' | 'atomic'): bigint {
  const trimmed = value.trim();
  if (units === 'atomic') {
    return BigInt(trimmed);
  }

  const [whole, fraction = ''] = trimmed.split('.');
  if (fraction.length > decimals) {
    throw new Error(`Too many decimal places: ${fraction.length} > ${decimals}`);
  }
  const paddedFraction = fraction.padEnd(decimals, '0');
  const normalized = `${whole}${paddedFraction}`.replace(/^0+(?=\d)/, '');
  return BigInt(normalized.length ? normalized : '0');
}

function formatAmount(value: bigint, decimals: number): string {
  const sign = value < 0n ? '-' : '';
  const abs = value < 0n ? -value : value;
  const base = abs.toString().padStart(decimals + 1, '0');
  const whole = base.slice(0, base.length - decimals);
  const fraction = base.slice(base.length - decimals).replace(/0+$/, '');
  return fraction.length ? `${sign}${whole}.${fraction}` : `${sign}${whole}`;
}

function resolvePayload(payloadBase64?: string): Uint8Array | undefined {
  if (!payloadBase64) return undefined;
  return Buffer.from(payloadBase64, 'base64');
}

async function createWormhole(network: Network, overrides?: Record<string, { rpc?: string }>) {
  const chains = overrides && Object.keys(overrides).length > 0 ? overrides : undefined;
  const loaders = [async () => evm, async () => solana];
  return await wormhole(network, loaders, chains ? { chains } : undefined);
}

function resolveTokenId(chain: Chain, tokenAddress?: string): TokenId {
  if (!tokenAddress || tokenAddress.toLowerCase() === 'native') {
    return Wormhole.tokenId(chain, 'native');
  }
  return Wormhole.tokenId(chain, tokenAddress);
}

function resolveDecimalsForToken(wh: Wormhole<Network>, chain: Chain, tokenAddress?: string): Promise<number> | number {
  if (!tokenAddress || tokenAddress.toLowerCase() === 'native') {
    const configDecimals = wh.config.chains?.[chain]?.nativeTokenDecimals;
    if (typeof configDecimals === 'number') return configDecimals;
    return chainToPlatform(chain) === 'Solana' ? 9 : 18;
  }
  return wh.getDecimals(chain, tokenAddress as any);
}

async function resolveSolanaSigner(connection: Connection): Promise<{ signer: any; address: string }> {
  const secret = process.env.SOLANA_PRIVATE_KEY;
  const keypairPath = process.env.SOLANA_KEYPAIR_PATH;
  if (!secret && !keypairPath) {
    throw new Error('Missing Solana credentials. Set SOLANA_PRIVATE_KEY or SOLANA_KEYPAIR_PATH.');
  }
  const bytes = secret ? decodeSecretKey(secret) : loadSolanaKeypair({ keypairPath }).secretKey;
  const base58 = bs58.encode(bytes);
  const signer = await getSolanaSigner(connection, base58);
  return { signer, address: signer.address() };
}

async function resolveEvmSigner(rpcUrl: string, chain: Chain): Promise<{ signer: any; address: string }> {
  const privateKey = resolvePrivateKeyForChain(chain);
  if (!privateKey) {
    throw new Error('Missing EVM credentials. Set EVM_PRIVATE_KEY or WORMHOLE_PRIVATE_KEY_<CHAIN>.');
  }
  const normalizedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const provider = new JsonRpcProvider(rpcUrl);
  const signer = await getEvmSigner(provider, normalizedKey);
  return { signer, address: signer.address() };
}

async function resolveSigner(
  wh: Wormhole<Network>,
  chain: Chain,
  rpcUrlOverride?: string
): Promise<{ signer: any; address: string }> {
  const rpcUrl = rpcUrlOverride || resolveRpcFromEnv(chain) || wh.config.chains?.[chain]?.rpc;
  if (!rpcUrl) {
    throw new Error(`Missing RPC URL for ${chain}. Set WORMHOLE_RPC_${chain.toUpperCase()} or platform RPC env.`);
  }

  const platform = chainToPlatform(chain);
  if (platform === 'Solana') {
    const connection = new Connection(rpcUrl, 'confirmed');
    return await resolveSolanaSigner(connection);
  }
  if (platform === 'Evm') {
    return await resolveEvmSigner(rpcUrl, chain);
  }
  throw new Error(`Unsupported chain platform: ${platform}`);
}

function buildOverridesForChains(params: {
  sourceChain: Chain;
  destinationChain: Chain;
  sourceRpcUrl?: string;
  destinationRpcUrl?: string;
}): Record<string, { rpc?: string }> | undefined {
  const overrides: Record<string, { rpc?: string }> = {};
  const sourceRpc = params.sourceRpcUrl || resolveRpcFromEnv(params.sourceChain);
  const destRpc = params.destinationRpcUrl || resolveRpcFromEnv(params.destinationChain);
  if (sourceRpc) overrides[params.sourceChain] = { rpc: sourceRpc };
  if (destRpc) overrides[params.destinationChain] = { rpc: destRpc };
  return Object.keys(overrides).length ? overrides : undefined;
}

export async function wormholeQuote(req: WormholeQuoteRequest) {
  const network = normalizeNetwork(req.network);
  const sourceChain = normalizeChain(req.source_chain);
  const destinationChain = normalizeChain(req.destination_chain);
  const protocol: WormholeProtocol = req.protocol || 'token_bridge';
  const automatic = req.automatic ?? false;

  const wh = await createWormhole(network, buildOverridesForChains({
    sourceChain,
    destinationChain,
    sourceRpcUrl: req.source_rpc_url,
    destinationRpcUrl: req.destination_rpc_url,
  }));

  const sourceAddress = req.source_address
    ? req.source_address
    : (await resolveSigner(wh, sourceChain, req.source_rpc_url)).address;

  const from = Wormhole.chainAddress(sourceChain, sourceAddress);
  const to = Wormhole.chainAddress(destinationChain, req.destination_address);
  const payload = resolvePayload(req.payload_base64);

  if (protocol === 'cctp') {
    const amountUnits = req.amount_units ?? 'human';
    const amount = parseAmount(req.amount, 6, amountUnits);
    const nativeGasUnits = req.destination_native_gas_units ?? 'human';
    const nativeGas = req.destination_native_gas
      ? parseAmount(req.destination_native_gas, wh.config.chains?.[destinationChain]?.nativeTokenDecimals ?? 18, nativeGasUnits)
      : undefined;

    const quote = await CircleTransfer.quoteTransfer(
      wh.getChain(sourceChain),
      wh.getChain(destinationChain),
      {
        amount,
        automatic,
        payload,
        nativeGas,
      }
    );

    return {
      protocol,
      automatic,
      source: { chain: sourceChain, address: sourceAddress },
      destination: { chain: destinationChain, address: req.destination_address },
      amount: {
        input: req.amount,
        units: amountUnits,
        atomic: amount.toString(),
        formatted: formatAmount(amount, 6),
      },
      quote: {
        source: {
          token: Wormhole.canonicalAddress(quote.sourceToken.token),
          amount_atomic: quote.sourceToken.amount.toString(),
        },
        destination: {
          token: Wormhole.canonicalAddress(quote.destinationToken.token),
          amount_atomic: quote.destinationToken.amount.toString(),
        },
        relay_fee_atomic: quote.relayFee?.amount?.toString(),
        destination_native_gas_atomic: quote.destinationNativeGas?.toString(),
        eta_ms: quote.eta,
        expires_at: quote.expires?.toISOString(),
        warnings: quote.warnings,
      },
    };
  }

  const tokenId = resolveTokenId(sourceChain, req.token_address);
  const decimals = await resolveDecimalsForToken(wh, sourceChain, req.token_address);
  const amountUnits = req.amount_units ?? 'human';
  const amount = parseAmount(req.amount, decimals, amountUnits);
  const nativeGasUnits = req.destination_native_gas_units ?? 'human';
  const nativeGas = req.destination_native_gas
    ? parseAmount(
        req.destination_native_gas,
        wh.config.chains?.[destinationChain]?.nativeTokenDecimals ?? 18,
        nativeGasUnits
      )
    : undefined;

  const transfer = automatic
    ? await wh.tokenTransfer(tokenId, amount, from, to, 'AutomaticTokenBridge', nativeGas)
    : await wh.tokenTransfer(tokenId, amount, from, to, 'TokenBridge', payload);

  const quote = await TokenTransfer.quoteTransfer(
    wh,
    wh.getChain(sourceChain),
    wh.getChain(destinationChain),
    transfer.transfer as any
  );

  return {
    protocol,
    automatic,
    source: { chain: sourceChain, address: sourceAddress },
    destination: { chain: destinationChain, address: req.destination_address },
    token: { id: Wormhole.canonicalAddress(tokenId), address: req.token_address ?? 'native' },
    amount: {
      input: req.amount,
      units: amountUnits,
      atomic: amount.toString(),
      formatted: formatAmount(amount, typeof decimals === 'number' ? decimals : 0),
    },
    quote: {
      source: {
        token: Wormhole.canonicalAddress(quote.sourceToken.token),
        amount_atomic: quote.sourceToken.amount.toString(),
      },
      destination: {
        token: Wormhole.canonicalAddress(quote.destinationToken.token),
        amount_atomic: quote.destinationToken.amount.toString(),
      },
      relay_fee_atomic: quote.relayFee?.amount?.toString(),
      destination_native_gas_atomic: quote.destinationNativeGas?.toString(),
      eta_ms: quote.eta,
      expires_at: quote.expires?.toISOString(),
      warnings: quote.warnings,
    },
  };
}

export async function wormholeBridge(req: WormholeBridgeRequest) {
  const network = normalizeNetwork(req.network);
  const sourceChain = normalizeChain(req.source_chain);
  const destinationChain = normalizeChain(req.destination_chain);
  const protocol: WormholeProtocol = req.protocol || 'token_bridge';
  const automatic = req.automatic ?? false;

  const wh = await createWormhole(network, buildOverridesForChains({
    sourceChain,
    destinationChain,
    sourceRpcUrl: req.source_rpc_url,
    destinationRpcUrl: req.destination_rpc_url,
  }));

  const sourceSigner = await resolveSigner(wh, sourceChain, req.source_rpc_url);
  const destinationSigner = automatic ? undefined : await resolveSigner(wh, destinationChain, req.destination_rpc_url);

  const payload = resolvePayload(req.payload_base64);
  const from = Wormhole.chainAddress(sourceChain, sourceSigner.address);
  const to = Wormhole.chainAddress(destinationChain, req.destination_address);

  if (protocol === 'cctp') {
    const amountUnits = req.amount_units ?? 'human';
    const amount = parseAmount(req.amount, 6, amountUnits);
    const nativeGasUnits = req.destination_native_gas_units ?? 'human';
    const nativeGas = req.destination_native_gas
      ? parseAmount(req.destination_native_gas, wh.config.chains?.[destinationChain]?.nativeTokenDecimals ?? 18, nativeGasUnits)
      : undefined;

    const xfer = await wh.circleTransfer(amount, from, to, automatic, payload, nativeGas);
    const quote = await CircleTransfer.quoteTransfer(
      wh.getChain(sourceChain),
      wh.getChain(destinationChain),
      {
        amount,
        automatic,
        payload,
        nativeGas,
      }
    );

    const sourceTxids = await xfer.initiateTransfer(sourceSigner.signer);
    if (automatic || req.skip_redeem) {
      return {
        protocol,
        automatic,
        source_txids: sourceTxids,
        quote,
      };
    }

    const attestations = await xfer.fetchAttestation(req.attest_timeout_ms ?? 900_000);
    const destinationTxids = await xfer.completeTransfer(destinationSigner!.signer);
    return {
      protocol,
      automatic,
      source_txids: sourceTxids,
      attestation_ids: attestations,
      destination_txids: destinationTxids,
      quote,
    };
  }

  const tokenId = resolveTokenId(sourceChain, req.token_address);
  const decimals = await resolveDecimalsForToken(wh, sourceChain, req.token_address);
  const amountUnits = req.amount_units ?? 'human';
  const amount = parseAmount(req.amount, decimals, amountUnits);
  const nativeGasUnits = req.destination_native_gas_units ?? 'human';
  const nativeGas = req.destination_native_gas
    ? parseAmount(
        req.destination_native_gas,
        wh.config.chains?.[destinationChain]?.nativeTokenDecimals ?? 18,
        nativeGasUnits
      )
    : undefined;

  const xfer = automatic
    ? await wh.tokenTransfer(tokenId, amount, from, to, 'AutomaticTokenBridge', nativeGas)
    : await wh.tokenTransfer(tokenId, amount, from, to, 'TokenBridge', payload);

  const quote = await TokenTransfer.quoteTransfer(
    wh,
    wh.getChain(sourceChain),
    wh.getChain(destinationChain),
    xfer.transfer as any
  );
  const sourceTxids = await xfer.initiateTransfer(sourceSigner.signer);

  if (automatic || req.skip_redeem) {
    return {
      protocol,
      automatic,
      source_txids: sourceTxids,
      quote,
    };
  }

  const attestations = await xfer.fetchAttestation(req.attest_timeout_ms ?? 900_000);
  const destinationTxids = await xfer.completeTransfer(destinationSigner!.signer);
  return {
    protocol,
    automatic,
    source_txids: sourceTxids,
    attestation_ids: attestations,
    destination_txids: destinationTxids,
    quote,
  };
}

export async function wormholeRedeem(req: WormholeRedeemRequest) {
  const network = normalizeNetwork(req.network);
  const sourceChain = normalizeChain(req.source_chain);
  const destinationChain = normalizeChain(req.destination_chain);
  const protocol: WormholeProtocol = req.protocol || 'token_bridge';

  const wh = await createWormhole(network, buildOverridesForChains({
    sourceChain,
    destinationChain,
    sourceRpcUrl: req.source_rpc_url,
    destinationRpcUrl: req.destination_rpc_url,
  }));

  const destinationSigner = await resolveSigner(wh, destinationChain, req.destination_rpc_url);
  const txid = { chain: sourceChain, txid: req.source_txid };

  if (protocol === 'cctp') {
    const xfer = await CircleTransfer.from(wh, txid);
    await xfer.fetchAttestation(req.attest_timeout_ms ?? 900_000);
    const destinationTxids = await xfer.completeTransfer(destinationSigner.signer);
    return {
      protocol,
      source_txid: req.source_txid,
      destination_txids: destinationTxids,
    };
  }

  const xfer = await TokenTransfer.from(wh, txid);
  await xfer.fetchAttestation(req.attest_timeout_ms ?? 900_000);
  const destinationTxids = await xfer.completeTransfer(destinationSigner.signer);
  return {
    protocol,
    source_txid: req.source_txid,
    destination_txids: destinationTxids,
  };
}

export async function usdcBridgeAuto(req: WormholeBridgeRequest) {
  const network = normalizeNetwork(req.network);
  const sourceChain = normalizeChain(req.source_chain);
  const destinationChain = normalizeChain(req.destination_chain);

  const cctpSupported = circle.isCircleChain(network, sourceChain)
    && circle.isCircleChain(network, destinationChain)
    && circle.isCircleSupported(network, sourceChain)
    && circle.isCircleSupported(network, destinationChain);

  if (cctpSupported) {
    return await wormholeBridge({ ...req, protocol: 'cctp' });
  }

  if (!req.token_address) {
    throw new Error('CCTP not supported for this route. Provide token_address for Token Bridge fallback.');
  }

  return await wormholeBridge({ ...req, protocol: 'token_bridge' });
}

export async function usdcQuoteAuto(req: WormholeQuoteRequest) {
  const network = normalizeNetwork(req.network);
  const sourceChain = normalizeChain(req.source_chain);
  const destinationChain = normalizeChain(req.destination_chain);

  const cctpSupported = circle.isCircleChain(network, sourceChain)
    && circle.isCircleChain(network, destinationChain)
    && circle.isCircleSupported(network, sourceChain)
    && circle.isCircleSupported(network, destinationChain);

  if (cctpSupported) {
    return await wormholeQuote({ ...req, protocol: 'cctp' });
  }

  if (!req.token_address) {
    throw new Error('CCTP not supported for this route. Provide token_address for Token Bridge fallback.');
  }

  return await wormholeQuote({ ...req, protocol: 'token_bridge' });
}
