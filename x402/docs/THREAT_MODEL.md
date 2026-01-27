# x402 Threat Model

> Understanding and mitigating security risks in x402 payment implementations.

---

## Overview

This document describes the threat model for x402 payment protocol implementations. It identifies potential attack vectors, assesses risks, and provides mitigation strategies.

---

## Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            TRUST BOUNDARIES                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐         ┌──────────────┐         ┌──────────────┐       │
│   │   AI Agent   │ ──────► │   x402 SDK   │ ──────► │  Blockchain  │       │
│   │   (Claude)   │         │              │         │   Network    │       │
│   └──────────────┘         └──────────────┘         └──────────────┘       │
│          │                        │                        │                │
│          │                        │                        │                │
│          ▼                        ▼                        ▼                │
│   ┌──────────────┐         ┌──────────────┐         ┌──────────────┐       │
│   │   MCP Host   │         │  Facilitator │         │   Service    │       │
│   │  (Desktop)   │         │   (Gasless)  │         │   Provider   │       │
│   └──────────────┘         └──────────────┘         └──────────────┘       │
│                                                                              │
│   Legend:                                                                    │
│   ──────► = Data/Transaction Flow                                           │
│   ━━━━━━  = Trust Boundary                                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Trust Levels

| Entity | Trust Level | Notes |
|--------|-------------|-------|
| AI Agent | Partial | Can make requests but limited by controls |
| MCP Host | High | Controls key access and tool availability |
| x402 SDK | High | Validates inputs and enforces limits |
| Facilitator | Medium | Third-party service for gasless payments |
| Service Provider | Low | External API requiring payment |
| Blockchain | High | Immutable, decentralized consensus |

---

## Threat Categories

### 1. Private Key Compromise

#### T1.1: Key Extraction from Environment

**Risk**: HIGH

**Attack Vector**: Malicious code, log analysis, or memory dump extracts private key.

**Mitigations**:
- Never log private keys (use `sanitizeForLogging()`)
- Use hardware wallets when possible (`registerExternalSigner()`)
- Validate key source security (`isKeySourceSecure()`)
- Rotate keys regularly

```typescript
// IMPLEMENTED: security.ts
// - validatePrivateKeyFormat() - validates without exposing
// - loadPrivateKeySecure() - secure loading from env
// - maskSensitiveData() - safe logging
```

#### T1.2: Key Exposure in Transit

**Risk**: MEDIUM

**Attack Vector**: Man-in-the-middle intercepts key during transmission.

**Mitigations**:
- Keys are never transmitted (only signatures)
- Use HTTPS exclusively for mainnet
- Validate TLS certificates

```typescript
// IMPLEMENTED: validation.ts
// - validateURL() - enforces HTTPS for mainnet
// - getURLValidationOptions() - stricter for production
```

---

### 2. Unauthorized Payments

#### T2.1: Runaway Spending

**Risk**: HIGH

**Attack Vector**: AI agent makes excessive payments due to prompt injection or bugs.

**Mitigations**:
- Single payment limits (`MAX_SINGLE_PAYMENT`)
- Daily spending limits (`MAX_DAILY_PAYMENT`)
- Large payment warnings and approval prompts
- Hard caps that cannot be overridden

```typescript
// IMPLEMENTED: limits.ts
// - validatePaymentLimits() - checks all limits
// - recordPayment() - tracks daily spending
// - DEFAULT_LIMITS - conservative defaults
```

#### T2.2: Payment to Malicious Services

**Risk**: HIGH

**Attack Vector**: AI agent pays untrusted service that doesn't deliver value.

**Mitigations**:
- Service allowlist (`approveService()`)
- Strict allowlist mode option
- Domain validation

```typescript
// IMPLEMENTED: limits.ts
// - isServiceApproved() - checks allowlist
// - setStrictAllowlistMode() - enforce whitelist
// - approveService() - add trusted services
```

#### T2.3: Price Manipulation

**Risk**: MEDIUM

**Attack Vector**: Service dynamically increases price after agent commits.

**Mitigations**:
- Amount validation before payment
- Maximum payment cap per request
- Estimate before pay workflow

```typescript
// IMPLEMENTED: validation.ts
// - validateAmount() - enforces max amounts
// IMPLEMENTED: tools.ts
// - x402_estimate - check price before paying
```

---

### 3. Replay Attacks

#### T3.1: Transaction Replay

**Risk**: HIGH

**Attack Vector**: Valid payment proof is reused to claim service multiple times.

**Mitigations**:
- Nonce tracking with expiry
- Payment ID generation
- Receipt storage

```typescript
// IMPLEMENTED: verification.ts
// - isNonceUsed() - detect replay
// - markNonceUsed() - prevent reuse
// - generatePaymentId() - unique IDs
```

#### T3.2: Authorization Replay (EIP-3009)

**Risk**: HIGH

**Attack Vector**: Signed gasless authorization is submitted multiple times.

**Mitigations**:
- Nonce validation for EIP-3009
- Time-bound authorizations
- On-chain nonce verification

```typescript
// IMPLEMENTED: verification.ts
// - verifyAuthorizationTiming() - check validity window
// - EIP-3009 nonce tracking in isNonceUsed()
```

---

### 4. Network Attacks

#### T4.1: SSRF via Payment URL

**Risk**: MEDIUM

**Attack Vector**: AI agent is tricked into accessing internal network resources.

**Mitigations**:
- Block localhost by default
- Block private IP ranges
- URL validation and sanitization

```typescript
// IMPLEMENTED: validation.ts
// - validateURL() - blocks dangerous URLs
// - isPrivateIP() - detects internal IPs
// - isLocalhost() - detects localhost
```

#### T4.2: DNS Rebinding

**Risk**: LOW

**Attack Vector**: DNS rebinding to access internal services.

**Mitigations**:
- IP validation at connection time
- Pin DNS resolutions
- Use IP-based allowlists when possible

---

### 5. Facilitator Attacks

#### T5.1: Malicious Facilitator

**Risk**: MEDIUM

**Attack Vector**: Facilitator doesn't submit payment or submits wrong payment.

**Mitigations**:
- Verify facilitator signatures
- Use trusted facilitators only
- Verify on-chain transactions

```typescript
// IMPLEMENTED: verification.ts
// - verifyFacilitatorSignature() - validate signatures
// - isTrustedFacilitator() - check trust status
// - registerFacilitator() - manage trusted list
```

#### T5.2: Facilitator Denial of Service

**Risk**: LOW

**Attack Vector**: Facilitator refuses to process payments.

**Mitigations**:
- Fallback to direct (non-gasless) payments
- Multiple facilitator support
- Local gas payment option

---

### 6. Mainnet vs Testnet Confusion

#### T6.1: Accidental Mainnet Usage

**Risk**: HIGH

**Attack Vector**: User accidentally uses real funds on mainnet.

**Mitigations**:
- Default to testnet
- Require explicit mainnet opt-in
- Clear warnings when on mainnet

```typescript
// IMPLEMENTED: config.ts
// - SECURE_DEFAULTS.defaultChain = "base-sepolia"
// - mainnetEnabled flag (requires X402_MAINNET_ENABLED=true)
// - Logging when mainnet is accessed
```

---

## Security Architecture

### Defense in Depth

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DEFENSE LAYERS                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Layer 1: Input Validation                                                  │
│   ├── URL validation (no localhost, no private IPs)                         │
│   ├── Amount validation (positive, within limits)                           │
│   └── Address validation (format, checksum)                                 │
│                                                                              │
│   Layer 2: Payment Limits                                                    │
│   ├── Single payment limit                                                  │
│   ├── Daily spending limit                                                  │
│   └── Service allowlist                                                     │
│                                                                              │
│   Layer 3: Cryptographic Verification                                        │
│   ├── Nonce tracking (replay protection)                                    │
│   ├── Facilitator signature verification                                    │
│   └── Payment proof validation                                              │
│                                                                              │
│   Layer 4: Secure Defaults                                                   │
│   ├── Testnet by default                                                    │
│   ├── Conservative limits                                                   │
│   └── HTTPS required for mainnet                                            │
│                                                                              │
│   Layer 5: Audit Trail                                                       │
│   ├── Security event logging                                                │
│   ├── Payment history                                                       │
│   └── Configuration change tracking                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Security Event Types

| Event | Severity | Description |
|-------|----------|-------------|
| `key_loaded` | info | Private key successfully loaded |
| `key_validation_failed` | warning | Invalid key format detected |
| `payment_limit_exceeded` | warning | Payment blocked by single limit |
| `daily_limit_exceeded` | warning | Payment blocked by daily limit |
| `untrusted_service` | warning | Payment to non-approved service |
| `invalid_address` | warning | Invalid recipient address |
| `invalid_url` | warning | Blocked/invalid URL |
| `replay_detected` | critical | Replay attack detected |
| `mainnet_access` | info/warning | Mainnet chain accessed |
| `large_payment_warning` | info | Payment above warning threshold |
| `config_changed` | info | Security configuration modified |

---

## Recommended Security Configuration

### Development/Testing

```bash
# Testnet only (default)
export X402_CHAIN=base-sepolia
export X402_MAX_PAYMENT=10.00
export X402_DEBUG=true

# Allow localhost for local testing
# (done automatically for testnet)
```

### Production

```bash
# Explicit mainnet opt-in
export X402_MAINNET_ENABLED=true
export X402_CHAIN=base

# Conservative limits
export X402_MAX_PAYMENT=1.00
export X402_MAX_DAILY=10.00
export X402_REQUIRE_APPROVAL_ABOVE=0.50

# Strict allowlist mode
export X402_STRICT_ALLOWLIST=true
export X402_APPROVED_SERVICES=api.example.com,trusted-service.io

# Disable debug in production
export X402_DEBUG=false
```

---

## Incident Response

### If Private Key is Compromised

1. **Immediately** transfer remaining funds to a new wallet
2. Generate a new private key
3. Update all configurations
4. Review payment history for unauthorized transactions
5. Report incident if funds were lost

### If Excessive Payments Detected

1. Stop the AI agent
2. Review payment history (`x402_get_payment_history`)
3. Lower payment limits
4. Enable strict allowlist mode
5. Investigate root cause

### If Replay Attack Detected

1. Check security events (`getSecurityEvents`)
2. Verify transaction on blockchain
3. Report to facilitator if applicable
4. Clear affected nonces only in test mode

---

## Compliance Considerations

- **PCI-DSS**: x402 does not store card data but handle wallet keys with similar care
- **GDPR**: Payment history may contain personal data - implement retention policies
- **SOC 2**: Enable audit logging and implement access controls

---

## Updates

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01-27 | Initial threat model |

---

## References

- [x402 Protocol Specification](https://x402.org/spec)
- [EIP-3009: Transfer With Authorization](https://eips.ethereum.org/EIPS/eip-3009)
- [OWASP API Security Top 10](https://owasp.org/API-Security/)
- [CAIP-2: Blockchain ID Specification](https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md)
