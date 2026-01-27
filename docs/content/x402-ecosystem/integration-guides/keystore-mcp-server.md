# Keystore MCP Server x402 Integration

> Encrypt/decrypt Ethereum keystore JSON V3 with scrypt/PBKDF2 for secure cold storage.

## Overview

**Repository:** [nirholas/keystore-mcp-server](https://github.com/nirholas/keystore-mcp-server)  
**MCP Registry:** `io.github.nirholas/keystore-mcp-server`  
**x402 Use Case:** Premium security features, HSM integration, audit logging

## Installation

```bash
npm install @nirholas/x402-ecosystem @nirholas/keystore-mcp-server
```

## Integration Pattern

```typescript
import { PaywallBuilder, PricingStrategy } from '@nirholas/x402-ecosystem/premium';
import { KeystoreService } from '@nirholas/keystore-mcp-server';

// Security tier pricing
const keystorePricing = PricingStrategy.fixed({
  'encrypt-basic': 0,          // Free: basic scrypt
  'encrypt-high': 0.01,        // $0.01: high-security params
  'encrypt-paranoid': 0.05,    // $0.05: paranoid settings
  'decrypt': 0,                // Free: decryption
  'batch-encrypt': 0.02,       // $0.02 per 10 keys
  'audit-log': 0.005,          // $0.005 per operation
  'hsm-signing': 0.10,         // $0.10: HSM-backed operations
  'key-rotation': 0.03         // $0.03: secure key rotation
});

const keystore = new PaywallBuilder()
  .service('keystore-mcp-server')
  .pricing(keystorePricing)
  .build();
```

## Encryption Tiers

```typescript
// Security level configurations
const securityLevels = {
  basic: {
    kdf: 'scrypt',
    n: 8192,      // ~100ms
    r: 8,
    p: 1,
    cost: 0
  },
  high: {
    kdf: 'scrypt',
    n: 262144,    // ~1s
    r: 8,
    p: 1,
    cost: 0.01
  },
  paranoid: {
    kdf: 'scrypt',
    n: 1048576,   // ~5s
    r: 8,
    p: 1,
    cost: 0.05
  }
};

// Encrypt with chosen security level
async function encryptKeystore(
  privateKey: string, 
  password: string, 
  level: 'basic' | 'high' | 'paranoid' = 'basic'
) {
  const config = securityLevels[level];
  
  if (config.cost > 0) {
    await keystore.charge(config.cost, { 
      type: 'encrypt',
      level,
      timestamp: Date.now()
    });
  }
  
  return KeystoreService.encrypt(privateKey, password, config);
}
```

## Audit Logging

```typescript
// Premium audit trail for compliance
async function encryptWithAudit(
  privateKey: string,
  password: string,
  metadata: AuditMetadata
) {
  // Charge for audit logging
  await keystore.charge(0.005, { type: 'audit-log' });
  
  const result = await KeystoreService.encrypt(privateKey, password, {
    kdf: 'scrypt',
    n: 262144
  });
  
  // Log operation (no sensitive data)
  await KeystoreService.auditLog({
    operation: 'encrypt',
    address: result.address,
    timestamp: Date.now(),
    ...metadata
  });
  
  return result;
}
```

## Batch Operations

```typescript
import { PayableAgent } from '@nirholas/x402-ecosystem/agent';

const agent = new PayableAgent({
  wallet: agentWallet,
  approvedServices: ['keystore-mcp-server']
});

// Batch encrypt multiple keys
async function batchEncrypt(
  keys: { privateKey: string; password: string }[],
  level: 'basic' | 'high' | 'paranoid' = 'high'
) {
  const batches = Math.ceil(keys.length / 10);
  const batchCost = batches * 0.02;
  const levelCost = keys.length * securityLevels[level].cost;
  
  await agent.pay({
    service: 'keystore-mcp-server',
    amount: batchCost + levelCost,
    description: `Batch encrypt ${keys.length} keys`
  });
  
  return KeystoreService.batchEncrypt(keys, securityLevels[level]);
}
```

## Key Rotation

```typescript
// Secure key rotation (premium)
async function rotateKeystore(
  oldKeystore: KeystoreV3,
  oldPassword: string,
  newPassword: string,
  newLevel: 'basic' | 'high' | 'paranoid' = 'high'
) {
  await keystore.charge(0.03, { type: 'key-rotation' });
  
  // Decrypt with old password
  const privateKey = await KeystoreService.decrypt(oldKeystore, oldPassword);
  
  // Re-encrypt with new password and level
  const newKeystore = await KeystoreService.encrypt(
    privateKey, 
    newPassword, 
    securityLevels[newLevel]
  );
  
  // Secure memory cleanup
  KeystoreService.secureWipe(privateKey);
  
  return newKeystore;
}
```

## Feature Matrix

| Feature | Free | Premium |
|---------|------|---------|
| Basic encryption | ✅ | ✅ |
| Decryption | ✅ | ✅ |
| High security | ❌ | $0.01 |
| Paranoid security | ❌ | $0.05 |
| Batch operations | ❌ | $0.02/10 |
| Audit logging | ❌ | $0.005 |
| HSM signing | ❌ | $0.10 |
| Key rotation | ❌ | $0.03 |

## Revenue Model

```typescript
const revenueSplit = {
  developer: 0.70,      // Keystore MCP maintainer
  ecosystem: 0.20,      // Universal Crypto MCP
  infrastructure: 0.10  // x402 + secure compute
};
```

## MCP Tool Registration

```typescript
server.tool('encrypt_keystore_premium', {
  description: 'Encrypt private key with premium security options',
  inputSchema: z.object({
    privateKey: z.string(),
    password: z.string().min(8),
    securityLevel: z.enum(['basic', 'high', 'paranoid']).default('high'),
    enableAudit: z.boolean().default(false)
  }),
  handler: async (params) => {
    if (params.enableAudit) {
      return encryptWithAudit(params.privateKey, params.password, {});
    }
    return encryptKeystore(params.privateKey, params.password, params.securityLevel);
  }
});
```
