# Signing MCP Server x402 Integration

> Sign Ethereum messages - EIP-191, EIP-712 typed data, Permit2, signature verification.

## Overview

**Repository:** [nirholas/signing-mcp-server](https://github.com/nirholas/signing-mcp-server)  
**MCP Registry:** `io.github.nirholas/signing-mcp-server`  
**x402 Use Case:** Per-signature fees, batch signing, HSM integration

## Installation

```bash
npm install @nirholas/x402-ecosystem @nirholas/signing-mcp-server
```

## Integration Pattern

```typescript
import { PaywallBuilder, PricingStrategy } from '@nirholas/x402-ecosystem/premium';
import { SigningService } from '@nirholas/signing-mcp-server';

// Per-operation pricing
const signingPricing = PricingStrategy.fixed({
  'verify': 0,                  // Free: verification
  'personal-sign': 0.001,       // $0.001: EIP-191
  'typed-data': 0.002,          // $0.002: EIP-712
  'permit2': 0.003,             // $0.003: Permit2 signatures
  'batch-sign': 0.005,          // $0.005: per 10 signatures
  'hsm-sign': 0.05,             // $0.05: HSM-backed signing
  'multisig-coord': 0.01        // $0.01: multisig coordination
});

const signing = new PaywallBuilder()
  .service('signing-mcp-server')
  .pricing(signingPricing)
  .build();
```

## Signature Types

```typescript
// EIP-191 Personal Sign
async function personalSign(message: string, privateKey: string) {
  await signing.charge(0.001, { type: 'personal-sign' });
  
  return SigningService.personalSign(message, privateKey);
}

// EIP-712 Typed Data
async function signTypedData(
  domain: TypedDataDomain,
  types: Record<string, TypedDataField[]>,
  value: Record<string, any>,
  privateKey: string
) {
  await signing.charge(0.002, { type: 'typed-data', domain: domain.name });
  
  return SigningService.signTypedData(domain, types, value, privateKey);
}

// Permit2 Signature
async function signPermit2(
  permit: Permit2Data,
  privateKey: string
) {
  await signing.charge(0.003, { type: 'permit2' });
  
  return SigningService.signPermit2(permit, privateKey);
}
```

## Batch Signing

```typescript
import { PayableAgent } from '@nirholas/x402-ecosystem/agent';

const agent = new PayableAgent({
  wallet: agentWallet,
  approvedServices: ['signing-mcp-server'],
  dailyLimit: 5
});

// Batch sign multiple messages
async function batchSign(
  messages: SignRequest[],
  privateKey: string
) {
  const batches = Math.ceil(messages.length / 10);
  const cost = batches * 0.005;
  
  await agent.pay({
    service: 'signing-mcp-server',
    amount: cost,
    description: `Batch sign ${messages.length} messages`
  });
  
  return SigningService.batchSign(messages, privateKey);
}
```

## HSM Integration

```typescript
// Premium HSM-backed signing
async function hsmSign(
  message: string | TypedData,
  keyId: string,
  hsmConfig: HSMConfig
) {
  await signing.charge(0.05, { type: 'hsm-sign', keyId });
  
  return SigningService.hsmSign(message, {
    keyId,
    provider: hsmConfig.provider, // 'aws-kms' | 'hashicorp-vault' | 'azure-keyvault'
    credentials: hsmConfig.credentials
  });
}
```

## Verification (Free)

```typescript
// Free signature verification
async function verifySignature(
  message: string,
  signature: string,
  expectedSigner?: string
): Promise<VerificationResult> {
  // No charge for verification
  const recovered = await SigningService.recover(message, signature);
  
  return {
    valid: !expectedSigner || recovered.toLowerCase() === expectedSigner.toLowerCase(),
    signer: recovered,
    messageHash: SigningService.hashMessage(message)
  };
}

// Verify EIP-712 typed data
async function verifyTypedData(
  domain: TypedDataDomain,
  types: Record<string, TypedDataField[]>,
  value: Record<string, any>,
  signature: string
): Promise<VerificationResult> {
  // No charge for verification
  return SigningService.verifyTypedData(domain, types, value, signature);
}
```

## Common Use Cases

```typescript
// Token approval via Permit2
const permit2Example = {
  permitted: {
    token: '0xUSDs...',
    amount: parseUnits('1000', 18)
  },
  spender: '0xDEXRouter...',
  nonce: await getNonce(owner),
  deadline: Math.floor(Date.now() / 1000) + 3600 // 1 hour
};

// Gasless swap signature
const swapSignature = await signPermit2(permit2Example, privateKey);

// Multisig transaction
async function signMultisig(txHash: string, safeAddress: string, privateKey: string) {
  await signing.charge(0.01, { type: 'multisig-coord' });
  
  return SigningService.signSafeTransaction(txHash, safeAddress, privateKey);
}
```

## Feature Matrix

| Feature | Free | Premium |
|---------|------|---------|
| Signature verification | ✅ | ✅ |
| Address recovery | ✅ | ✅ |
| Personal sign (EIP-191) | ❌ | $0.001 |
| Typed data (EIP-712) | ❌ | $0.002 |
| Permit2 signatures | ❌ | $0.003 |
| Batch signing | ❌ | $0.005/10 |
| HSM integration | ❌ | $0.05 |
| Multisig coordination | ❌ | $0.01 |

## Revenue Model

```typescript
const revenueSplit = {
  developer: 0.70,      // Signing MCP maintainer
  ecosystem: 0.20,      // Universal Crypto MCP
  infrastructure: 0.10  // x402 + HSM costs
};
```

## MCP Tool Registration

```typescript
server.tool('sign_message', {
  description: 'Sign Ethereum message (EIP-191, EIP-712, Permit2)',
  inputSchema: z.object({
    type: z.enum(['personal', 'typed-data', 'permit2']),
    message: z.union([z.string(), z.object({})]),
    privateKey: z.string().optional(), // Or use connected wallet
  }),
  handler: async (params) => {
    switch (params.type) {
      case 'personal':
        return personalSign(params.message as string, params.privateKey);
      case 'typed-data':
        return signTypedData(...parseTypedData(params.message));
      case 'permit2':
        return signPermit2(params.message as Permit2Data, params.privateKey);
    }
  }
});

server.tool('verify_signature', {
  description: 'Verify Ethereum signature (free)',
  inputSchema: z.object({
    message: z.string(),
    signature: z.string(),
    expectedSigner: z.string().optional()
  }),
  handler: async (params) => {
    return verifySignature(params.message, params.signature, params.expectedSigner);
  }
});
```
