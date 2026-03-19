// =============================================================================
// SECURITY SHIELD — Multi-chain Address Checker
// =============================================================================
// Checks Solana & EVM addresses via native fetch (no SDK deps).
// Combines scam DB lookup + on-chain heuristics for risk scoring.

import type { AddressCheckResult, ChainType, RiskLevel } from './types.js';
import { isKnownScam } from './scam-db.js';

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_SOLANA_RPC = 'https://api.mainnet-beta.solana.com';
const DEFAULT_EVM_RPC = 'https://eth.llamarpc.com';

// ── Chain detection (matches token-security pattern) ─────────────────────────

export function detectChain(address: string): ChainType {
  const trimmed = address.trim();
  if (trimmed.toLowerCase().startsWith('0x') && trimmed.length === 42) return 'evm';
  return 'solana';
}

// ── Risk level mapping ───────────────────────────────────────────────────────

function scoreToLevel(score: number): RiskLevel {
  if (score <= 10) return 'clean';
  if (score <= 30) return 'low';
  if (score <= 60) return 'medium';
  if (score <= 85) return 'high';
  return 'critical';
}

// ── Solana RPC helper ────────────────────────────────────────────────────────

async function solanaRpc(rpcUrl: string, method: string, params: unknown[]): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });
    const json = await res.json() as any;
    if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
    return json.result;
  } finally {
    clearTimeout(timeout);
  }
}

// ── EVM RPC helper ───────────────────────────────────────────────────────────

async function evmRpc(rpcUrl: string, method: string, params: unknown[]): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });
    const json = await res.json() as any;
    if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
    return json.result;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Solana address check ─────────────────────────────────────────────────────

async function checkSolana(address: string, rpcUrl: string): Promise<AddressCheckResult> {
  let score = 0;
  const flags: string[] = [];
  const details: AddressCheckResult['details'] = { exists: false };

  // 1. Scam DB
  const scam = isKnownScam(address);
  if (scam) {
    return {
      address, chain: 'solana', riskScore: 100, level: 'critical',
      flags: [`Known scam: ${scam.label} (${scam.type})`],
      scamMatch: scam,
      details: { exists: true },
    };
  }

  try {
    // 2. getAccountInfo
    const acctInfo = await solanaRpc(rpcUrl, 'getAccountInfo', [address, { encoding: 'base64' }]);
    if (acctInfo?.value) {
      details.exists = true;
      if (acctInfo.value.executable) {
        details.isContract = true;
        flags.push('Executable program');
      }
      details.balance = (acctInfo.value.lamports || 0) / 1e9;
    } else {
      flags.push('Account does not exist on-chain');
      score += 10;
    }

    // 3. Fetch recent signatures (single call for both age + velocity)
    const sigs = await solanaRpc(rpcUrl, 'getSignaturesForAddress', [address, { limit: 100 }]);

    // 4. Account age — use OLDEST signature (last in array, since results are newest-first)
    if (sigs && sigs.length > 0) {
      const oldestSig = sigs[sigs.length - 1];
      const oldestTs = oldestSig.blockTime;
      if (oldestTs) {
        const ageHours = (Date.now() / 1000 - oldestTs) / 3600;
        if (ageHours < 1) {
          score += 25;
          details.ageEstimate = '< 1 hour';
          flags.push('Very new account (< 1h)');
        } else if (ageHours < 24) {
          score += 15;
          details.ageEstimate = '< 24 hours';
          flags.push('New account (< 24h)');
        } else if (ageHours < 168) {
          score += 10;
          details.ageEstimate = '< 7 days';
          flags.push('Recent account (< 7d)');
        } else {
          details.ageEstimate = `${Math.floor(ageHours / 24)}d`;
        }
      }

      // 5. Transaction velocity
      if (sigs.length > 1) {
        const newest = sigs[0].blockTime;
        const oldest = oldestTs;
        if (newest && oldest && newest !== oldest) {
          const hours = (newest - oldest) / 3600;
          const velocity = sigs.length / Math.max(hours, 0.01);
          details.txVelocity = Math.round(velocity);
          if (velocity > 100) {
            score += 15;
            flags.push(`High tx velocity: ${Math.round(velocity)}/hr`);
          }
        }
      }
    }

    // 6. Zero balance + many txs
    if (details.balance === 0 && sigs && sigs.length >= 50) {
      score += 15;
      flags.push('Zero balance with many transactions');
    }
  } catch (err) {
    flags.push(`RPC check failed: ${err instanceof Error ? err.message : 'unknown'}`);
    // Fail-closed: if we can't verify on-chain, treat as medium risk minimum
    score = Math.max(score, 50);
  }

  score = Math.max(0, Math.min(100, score));
  return { address, chain: 'solana', riskScore: score, level: scoreToLevel(score), flags, details };
}

// ── EVM address check ────────────────────────────────────────────────────────

async function checkEvm(address: string, rpcUrl: string): Promise<AddressCheckResult> {
  let score = 0;
  const flags: string[] = [];
  const details: AddressCheckResult['details'] = { exists: false };

  // 1. Scam DB
  const scam = isKnownScam(address);
  if (scam) {
    return {
      address, chain: 'evm', riskScore: 100, level: 'critical',
      flags: [`Known scam: ${scam.label} (${scam.type})`],
      scamMatch: scam,
      details: { exists: true },
    };
  }

  try {
    // 2. Balance (use BigInt division to avoid Number overflow for large balances)
    const balHex = await evmRpc(rpcUrl, 'eth_getBalance', [address, 'latest']);
    const balWei = BigInt(balHex || '0x0');
    // Convert to ETH: integer part via BigInt division, fractional via remainder
    const ethWhole = balWei / BigInt(1e18);
    const ethFrac = Number(balWei % BigInt(1e18)) / 1e18;
    details.balance = Number(ethWhole) + ethFrac;
    details.exists = true;

    // 3. Nonce (proxy for account age / activity)
    const nonceHex = await evmRpc(rpcUrl, 'eth_getTransactionCount', [address, 'latest']);
    const nonce = parseInt(nonceHex || '0x0', 16);
    if (nonce === 0 && details.balance === 0) {
      score += 15;
      flags.push('Empty account (no txs, no balance)');
      details.ageEstimate = 'unknown (no txs)';
    } else if (nonce < 3) {
      score += 10;
      flags.push('Very low nonce (< 3 txs)');
      details.ageEstimate = 'very new';
    } else {
      details.ageEstimate = `${nonce} txs`;
    }

    // 4. Contract check
    const code = await evmRpc(rpcUrl, 'eth_getCode', [address, 'latest']);
    if (code && code !== '0x') {
      details.isContract = true;
      const codeLen = (code.length - 2) / 2;
      if (codeLen < 100) {
        score += 10;
        flags.push(`Very short bytecode (${codeLen} bytes)`);
      }
      flags.push(`Contract (${codeLen} bytes)`);
    }

    // 5. Zero balance + high nonce = suspicious (drained)
    if (details.balance === 0 && nonce > 50) {
      score += 15;
      flags.push('Zero balance with high nonce (possible drained wallet)');
    }
  } catch (err) {
    flags.push(`RPC check failed: ${err instanceof Error ? err.message : 'unknown'}`);
    // Fail-closed: if we can't verify on-chain, treat as medium risk minimum
    score = Math.max(score, 50);
  }

  score = Math.max(0, Math.min(100, score));
  return { address, chain: 'evm', riskScore: score, level: scoreToLevel(score), flags, details };
}

// =============================================================================
// EXPORTS
// =============================================================================

export async function checkAddress(
  address: string,
  chain?: ChainType | string,
  config?: { solanaRpcUrl?: string; evmRpcUrl?: string },
): Promise<AddressCheckResult> {
  const resolvedChain: ChainType = (chain as ChainType) || detectChain(address);
  if (resolvedChain === 'solana') {
    return checkSolana(address, config?.solanaRpcUrl || DEFAULT_SOLANA_RPC);
  }
  return checkEvm(address, config?.evmRpcUrl || DEFAULT_EVM_RPC);
}
