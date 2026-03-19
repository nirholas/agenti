// =============================================================================
// SECURITY SHIELD — Facade
// =============================================================================
// Unified entry point wrapping code-scanner, scam-db, address-checker,
// tx-validator, and sanitizer. Named "shield" to avoid collision with
// existing src/security/index.ts (auth/access module).

import type {
  AddressCheckResult,
  ChainType,
  CodeScanResult,
  SanitizeResult,
  ScamEntry,
  SecurityServiceConfig,
  SecurityStats,
  TxValidationRequest,
  TxValidationResult,
} from './types.js';

import { scanCode } from './code-scanner.js';
import { isKnownScam, getScamDbSize } from './scam-db.js';
import { checkAddress } from './address-checker.js';
import { validateTx } from './tx-validator.js';
import { sanitizeInput } from './sanitizer.js';

// ── Interface ────────────────────────────────────────────────────────────────

export interface SecurityShield {
  scanCode(code: string): CodeScanResult;
  checkAddress(address: string, chain?: ChainType | string): Promise<AddressCheckResult>;
  validateTx(tx: TxValidationRequest): Promise<TxValidationResult>;
  sanitize(input: string): SanitizeResult;
  getStats(): SecurityStats;
  isKnownScam(address: string): ScamEntry | null;
}

// ── Implementation ───────────────────────────────────────────────────────────

export function createSecurityShield(config?: SecurityServiceConfig): SecurityShield {
  const stats: SecurityStats = {
    codeScans: 0,
    addressChecks: 0,
    txValidations: 0,
    sanitizations: 0,
    threatsBlocked: 0,
    scamDbSize: getScamDbSize(),
  };

  const rpcConfig = {
    solanaRpcUrl: config?.solanaRpcUrl,
    evmRpcUrl: config?.evmRpcUrl,
  };

  return {
    scanCode(code: string): CodeScanResult {
      stats.codeScans++;
      const result = scanCode(code);
      if (result.level === 'high' || result.level === 'critical') stats.threatsBlocked++;
      return result;
    },

    async checkAddress(address: string, chain?: ChainType | string): Promise<AddressCheckResult> {
      stats.addressChecks++;
      const result = await checkAddress(address, chain as ChainType, rpcConfig);
      if (result.level === 'critical') stats.threatsBlocked++;
      return result;
    },

    async validateTx(tx: TxValidationRequest): Promise<TxValidationResult> {
      stats.txValidations++;
      const result = await validateTx(tx, rpcConfig);
      if (!result.allowed) stats.threatsBlocked++;
      return result;
    },

    sanitize(input: string): SanitizeResult {
      stats.sanitizations++;
      const result = sanitizeInput(input);
      if (result.threats.length > 0) stats.threatsBlocked++;
      return result;
    },

    getStats(): SecurityStats {
      stats.scamDbSize = getScamDbSize();
      return { ...stats };
    },

    isKnownScam(address: string): ScamEntry | null {
      return isKnownScam(address);
    },
  };
}

// ── Singleton ────────────────────────────────────────────────────────────────

let _instance: SecurityShield | null = null;

export function initSecurityShield(config?: SecurityServiceConfig): SecurityShield {
  _instance = createSecurityShield(config);
  return _instance;
}

export function getSecurityShield(): SecurityShield {
  if (!_instance) _instance = createSecurityShield();
  return _instance;
}
