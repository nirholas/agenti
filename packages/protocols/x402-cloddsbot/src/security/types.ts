// =============================================================================
// SECURITY SHIELD — Shared Types
// =============================================================================

/** Code scan detection categories */
export type CodeScanCategory =
  | 'shell_exec'
  | 'network_exfil'
  | 'wallet_drain'
  | 'prompt_injection'
  | 'obfuscation'
  | 'hidden_chars'
  | 'data_access'
  | 'crypto_theft'
  | 'privilege_escalation';

export interface CodeScanDetection {
  category: CodeScanCategory;
  pattern: string;
  description: string;
  weight: number;
  line?: number;
}

export type RiskLevel = 'clean' | 'low' | 'medium' | 'high' | 'critical';

export interface CodeScanResult {
  score: number;
  level: RiskLevel;
  detections: CodeScanDetection[];
  entropy?: number;
}

/** Chain types for address checks */
export type ChainType = 'solana' | 'evm';

export interface AddressCheckResult {
  address: string;
  chain: ChainType;
  riskScore: number;
  level: RiskLevel;
  flags: string[];
  scamMatch?: ScamEntry;
  details: {
    exists: boolean;
    isContract?: boolean;
    balance?: number;
    ageEstimate?: string;
    txVelocity?: number;
  };
}

/** Transaction validation */
export interface TxValidationRequest {
  destination: string;
  amount: number;
  token?: string;
  chain?: ChainType;
  context?: string;
}

export interface TxValidationResult {
  allowed: boolean;
  riskScore: number;
  flags: string[];
  recommendation: 'proceed' | 'review' | 'block';
  addressCheck?: AddressCheckResult;
}

/** Scam database types */
export type ScamType =
  | 'drainer'
  | 'phishing'
  | 'rug_pull'
  | 'exploit'
  | 'honeypot'
  | 'fake_token'
  | 'pump_dump'
  | 'impersonator'
  | 'known_hacker';

export interface ScamEntry {
  address: string;
  chain: ChainType;
  type: ScamType;
  label: string;
  severity: number;
  addedAt: number;
}

/** Input sanitizer types */
export interface SanitizeThreat {
  type: string;
  description: string;
  position: number;
}

export interface SanitizeResult {
  clean: string;
  threats: SanitizeThreat[];
  modified: boolean;
}

/** Service config */
export interface SecurityServiceConfig {
  solanaRpcUrl?: string;
  evmRpcUrl?: string;
  enableAddressChecks?: boolean;
  enableTxValidation?: boolean;
}

export interface SecurityStats {
  codeScans: number;
  addressChecks: number;
  txValidations: number;
  sanitizations: number;
  threatsBlocked: number;
  scamDbSize: number;
}
