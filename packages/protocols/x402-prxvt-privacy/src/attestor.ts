/**
 * Attestor Client for Cross-Chain Nullifier Verification
 * Requests attestations for instant cross-chain payments
 */

import { encodeAbiParameters, parseAbiParameters } from 'viem';
import { logger } from './logger';

/** Default attestor URL */
const DEFAULT_ATTESTOR_URL = 'https://robust-alignment-production.up.railway.app';

/** Attestation response from attestor service */
export interface AttestationResponse {
  success: boolean;
  chainEid: number;
  nullifierHash: string;
  timestamp: number;
  signature: string;
  attestor: string;
  expiresAt: number;
}

/** Chain name to LayerZero EID mapping */
const CHAIN_EID_MAP: Record<string, number> = {
  base: 30184,       // Base Mainnet
  polygon: 30109,    // Polygon Mainnet
  'base-sepolia': 40245,
  'polygon-amoy': 40267,
};

/** Reverse mapping: EID to chain name */
const EID_CHAIN_MAP: Record<number, string> = {
  30184: 'base',
  30109: 'polygon',
  40245: 'base-sepolia',
  40267: 'polygon-amoy',
};

/**
 * Get chain EID from chain name
 */
export function getChainEid(chainName: string): number {
  const eid = CHAIN_EID_MAP[chainName.toLowerCase()];
  if (!eid) {
    throw new Error(`Unknown chain: ${chainName}`);
  }
  return eid;
}

/**
 * Get chain name from EID
 */
export function getChainName(eid: number): string {
  return EID_CHAIN_MAP[eid] || `chain-${eid}`;
}

/**
 * Check if payment is cross-chain
 * @param depositChain - Chain where note was deposited
 * @param paymentChain - Chain where payment is being made
 */
export function isCrossChain(depositChain: string, paymentChain: string): boolean {
  return depositChain.toLowerCase() !== paymentChain.toLowerCase();
}

/**
 * Convert decimal string to bytes32 hex format
 */
function toBytes32Hex(decimalStr: string): `0x${string}` {
  // Handle both decimal strings and existing hex strings
  if (decimalStr.startsWith('0x')) {
    // Already hex - just ensure proper padding
    const hex = decimalStr.slice(2).padStart(64, '0');
    return `0x${hex}` as `0x${string}`;
  }
  // Convert decimal to hex and pad to 32 bytes (64 hex chars)
  const bn = BigInt(decimalStr);
  const hex = bn.toString(16).padStart(64, '0');
  return `0x${hex}` as `0x${string}`;
}

/**
 * Request nullifier attestation from attestor service
 * @param attestorUrl - Attestor service URL
 * @param chainEid - Origin chain EID (where note was deposited)
 * @param nullifierHash - Nullifier hash to verify (decimal or hex string)
 * @returns Attestation data or null if failed
 */
export async function requestNullifierAttestation(
  attestorUrl: string | undefined,
  chainEid: number,
  nullifierHash: string
): Promise<AttestationResponse | null> {
  const url = attestorUrl || DEFAULT_ATTESTOR_URL;

  // Convert to bytes32 hex format for attestor service
  const nullifierHashHex = toBytes32Hex(nullifierHash);

  try {
    logger.debug(`Requesting attestation from ${url}`);
    logger.debug(`Chain EID: ${chainEid}`);
    logger.debug(`Nullifier: ${nullifierHashHex.slice(0, 20)}...`);

    const response = await fetch(`${url}/attest/nullifier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chainEid,
        nullifierHash: nullifierHashHex,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { isUsed?: boolean };
      logger.error(`Attestation failed:`, errorData);

      // If nullifier is already used, throw specific error
      if (errorData.isUsed) {
        throw new Error('Nullifier already used on origin chain');
      }

      return null;
    }

    const attestation = await response.json() as AttestationResponse;
    logger.debug(`Attestation received (expires in ${attestation.expiresAt - Math.floor(Date.now()/1000)}s)`);

    return attestation;
  } catch (error) {
    logger.error(`Attestation request failed:`, error);
    throw error;
  }
}

/**
 * Encode attestation data for paymaster
 * Format: abi.encode(timestamp, signature)
 */
export function encodeAttestationData(attestation: AttestationResponse): `0x${string}` {
  const encoded = encodeAbiParameters(
    parseAbiParameters('uint256, bytes'),
    [BigInt(attestation.timestamp), attestation.signature as `0x${string}`]
  );
  return encoded;
}

/**
 * Get attestation for cross-chain payment
 * Helper that combines checking if cross-chain + requesting attestation
 */
export async function getAttestationForPayment(
  attestorUrl: string | undefined,
  depositChain: string,
  paymentChain: string,
  nullifierHash: string
): Promise<{ originEid: number; attestationData: `0x${string}` } | null> {
  // Check if cross-chain
  if (!isCrossChain(depositChain, paymentChain)) {
    // Same chain - no attestation needed
    return null;
  }

  // Get origin chain EID
  const originEid = getChainEid(depositChain);

  // Request attestation
  const attestation = await requestNullifierAttestation(
    attestorUrl,
    originEid,
    nullifierHash
  );

  if (!attestation) {
    throw new Error('Failed to get attestation for cross-chain payment');
  }

  // Encode attestation data
  const attestationData = encodeAttestationData(attestation);

  return { originEid, attestationData };
}
