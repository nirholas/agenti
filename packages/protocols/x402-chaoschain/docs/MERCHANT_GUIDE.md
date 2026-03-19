# Merchant Guide: Selling Services with x402

This guide shows how to monetize your AI agent services using ChaosChain's x402 facilitator. Set up a payment-protected API in minutes.

## What You Get

- ✅ **Non-custodial payments:** Funds go directly to you, no custody risk
- ✅ **Gasless for payers:** They only need USDC, no ETH required
- ✅ **No approvals needed:** Single EIP-3009 signature, not approve + transfer
- ✅ **Agent identity:** Every payment tied to ERC-8004 Proof-of-Agency
- ✅ **Multi-chain support:** Base, Ethereum (testnets + mainnets)
- ✅ **Simple integration:** 2 HTTP endpoints, any language
- ✅ **Fast settlement:** < 2 seconds on-chain

## How It Works

```
1. Client requests your service
   ↓
2. You return 402 Payment Required with requirements
   ↓
3. Client signs EIP-3009 authorization (gasless, single signature)
   ↓
4. Client retries with X-PAYMENT header
   ↓
5. You verify + settle via facilitator
   ↓
6. You receive USDC (minus 1% fee)
   ↓
7. Transaction recorded in ValidationRegistry (ERC-8004)
```

**Key Difference from Traditional Payments:**
- ❌ NO `approve()` transaction needed
- ❌ NO allowance checks
- ❌ NO gas fees for payer
- ✅ Single EIP-3009 signature authorizes the transfer

---

## Quick Start

### Installation

**TypeScript:**
```bash
npm install @chaoschain/sdk express
```

**Python:**
```bash
pip install chaoschain-sdk fastapi uvicorn
```

---

## TypeScript Example

### Option A: Using Built-in X402Server (Easiest)

```typescript
import { ethers } from 'ethers';
import { X402PaymentManager, X402Server, WalletManager } from '@chaoschain/sdk';

async function main() {
  // 1. Initialize wallet
  const provider = new ethers.JsonRpcProvider(
    process.env.RPC_URL || 'https://sepolia.base.org'
  );
  const walletManager = new WalletManager(
    { privateKey: process.env.MERCHANT_PRIVATE_KEY },
    provider
  );

  // 2. Initialize X402 Payment Manager
  const paymentManager = new X402PaymentManager(
    walletManager.getWallet(),
    'base-sepolia',
    {
      facilitatorUrl: process.env.FACILITATOR_URL || 'https://facilitator.chaoscha.in',
      mode: 'managed',
      agentId: process.env.AGENT_ID // Optional: for ERC-8004 tracking
    }
  );

  // 3. Create X402 Server
  const server = new X402Server(paymentManager, {
    port: 3000,
    host: '0.0.0.0',
    defaultCurrency: 'USDC'
  });

  // 4. Register protected endpoints
  server.requirePayment(1.00, 'AI Analysis Service', 'USDC')(
    async function aiAnalysis(data: any) {
      // Your service logic here
      return {
        result: 'Analysis complete',
        data: { /* your analysis results */ }
      };
    }
  );

  server.requirePayment(0.50, 'Image Generation', 'USDC')(
    async function imageGeneration(data: any) {
      return {
        result: 'Image generated',
        imageUrl: 'https://example.com/image.png'
      };
    }
  );

  // 5. Start server
  server.start();

  console.log('✅ X402 Paywall Server is running!');
  console.log('   Facilitator: https://facilitator.chaoscha.in');
  console.log('   Merchant wallet:', walletManager.getAddress());
}

main().catch(console.error);
```

### Option B: Manual Express Implementation

```typescript
import express from 'express';
import { ethers } from 'ethers';
import { X402PaymentManager, WalletManager } from '@chaoschain/sdk';

const app = express();
app.use(express.json());

// Initialize wallet
const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
const walletManager = new WalletManager(
  { privateKey: process.env.MERCHANT_PRIVATE_KEY },
  provider
);

// Initialize X402 Payment Manager
const paymentManager = new X402PaymentManager(
  walletManager.getWallet(),
  'base-sepolia',
  {
    facilitatorUrl: 'https://facilitator.chaoscha.in',
    mode: 'managed'
  }
);

// Middleware: Check for payment
async function requirePayment(amount: number, description: string) {
  return async (req: any, res: any, next: any) => {
    const xPaymentHeader = req.headers['x-payment'];

    if (!xPaymentHeader) {
      // Return 402 with payment requirements
      const requirements = paymentManager.createPaymentRequirements(
        amount,
        'USDC',
        description,
        req.path
      );

      return res.status(402).json({
        x402Version: 1,
        accepts: [{
          scheme: requirements.scheme,
          network: requirements.network,
          asset: requirements.asset
        }],
        paymentRequirements: requirements,
        facilitator: {
          verify: 'https://facilitator.chaoscha.in/verify',
          settle: 'https://facilitator.chaoscha.in/settle'
        }
      });
    }

    // Verify payment
    try {
      const paymentHeader = JSON.parse(
        Buffer.from(xPaymentHeader, 'base64').toString('utf-8')
      );

      const requirements = paymentManager.createPaymentRequirements(
        amount,
        'USDC',
        description,
        req.path
      );

      // Verify with facilitator
      const verifyResponse = await fetch('https://facilitator.chaoscha.in/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          x402Version: 1,
          paymentHeader,
          paymentRequirements: requirements
        })
      });

      const verifyData = await verifyResponse.json();

      if (!verifyData.isValid) {
        return res.status(402).json({ 
          error: 'Invalid payment', 
          reason: verifyData.invalidReason 
        });
      }

      // Store payment info for settlement after request processing
      req.payment = {
        header: paymentHeader,
        requirements: requirements,
        verified: true
      };
      
      next();

    } catch (error: any) {
      res.status(500).json({ 
        error: 'Payment verification failed', 
        message: error.message 
      });
    }
  };
}

// Helper function to settle payment after successful response
async function settlePayment(paymentInfo: any) {
  const settleResponse = await fetch('https://facilitator.chaoscha.in/settle', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Idempotency-Key': `${paymentInfo.requirements.resource}_${paymentInfo.header.nonce}`
    },
    body: JSON.stringify({
      x402Version: 1,
      paymentHeader: paymentInfo.header,
      paymentRequirements: paymentInfo.requirements,
      agentId: process.env.AGENT_ID
    })
  });

  return await settleResponse.json();
}

// Use the middleware
app.get('/api/analyze', requirePayment(1.00, 'AI Analysis'), async (req, res) => {
  try {
    // 1. Process the request
    const result = {
      result: 'Analysis complete',
      data: { confidence: 0.95 }
    };
    
    // 2. If processing succeeds, settle the payment
    if (req.payment?.verified) {
      const settlement = await settlePayment(req.payment);
      
      if (!settlement.success) {
        return res.status(402).json({ 
          error: 'Payment settlement failed',
          details: 'Service completed but payment failed'
        });
      }
      
      // 3. Return result with payment receipt
      return res.json({
        ...result,
        payment_receipt: {
          txHash: settlement.txHash,
          amount: settlement.amount,
          fee: settlement.fee,
          net: settlement.net
        }
      });
    }
    
    // No payment needed (shouldn't reach here with middleware)
    return res.json(result);
    
  } catch (error: any) {
    // 4. If processing fails, DON'T settle
    return res.status(500).json({ 
      error: 'Service failed',
      message: error.message 
    });
  }
});

app.get('/api/generate-image', requirePayment(0.50, 'Image Generation'), async (req, res) => {
  try {
    // Process request
    const result = {
      result: 'Image generated',
      imageUrl: 'https://example.com/image.png'
    };
    
    // Settle after successful processing
    if (req.payment?.verified) {
      const settlement = await settlePayment(req.payment);
      if (settlement.success) {
        result.payment_receipt = {
          txHash: settlement.txHash,
          amount: settlement.amount
        };
      }
    }
    
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('💰 Paywall server running on port 3000');
});
```

---

## Python Example

### Using ChaosChain SDK with FastAPI

```python
import os
import base64
import json
from fastapi import FastAPI, Header, HTTPException
from chaoschain_sdk import ChaosChainAgentSDK

app = FastAPI()

# Initialize ChaosChain SDK
sdk = ChaosChainAgentSDK(
    agent_name="MyAIAgent",

    network="base-sepolia"
)

# Configure facilitator (via environment variables)
os.environ["X402_USE_FACILITATOR"] = "true"
os.environ["X402_FACILITATOR_URL"] = "https://facilitator.chaoscha.in"

@app.get("/api/analyze")
async def analyze(x_payment: str = Header(None, alias="X-PAYMENT")):
    """AI Analysis - $1.00 USDC"""
    
    if not x_payment:
        # Return 402 Payment Required
        requirements = sdk.x402_payment_manager.create_payment_requirements(
            to_agent="MyAIAgent",
            amount_usdc=1.00,
            service_description="AI Analysis Service"
        )
        
        raise HTTPException(
            status_code=402,
            detail={
                "x402Version": 1,
                "accepts": [{
                    "scheme": "exact",
                    "network": "base-sepolia",
                    "asset": requirements.asset
                }],
                "paymentRequirements": requirements.model_dump(),
                "facilitator": {
                    "verify": "https://facilitator.chaoscha.in/verify",
                    "settle": "https://facilitator.chaoscha.in/settle"
                }
            }
        )
    
    # Verify payment and process request
    try:
        requirements = sdk.x402_payment_manager.create_payment_requirements(
            to_agent="MyAIAgent",
            amount_usdc=1.00,
            service_description="AI Analysis Service"
        )
        
        # 1. Verify payment with facilitator
        verify_result = sdk.x402_payment_manager.verify_payment_with_facilitator(
            x402_payment={"x_payment_header": x_payment},
            payment_requirements=requirements
        )
        
        if not verify_result.get("isValid"):
            raise HTTPException(
                status_code=402,
                detail={"error": "Invalid payment", "reason": verify_result.get("invalidReason")}
            )
        
        # 2. Process the request (your service logic)
        result = {
            "result": "Analysis complete",
            "data": {"confidence": 0.95, "insights": "Sample analysis..."}
        }
        
        # 3. If processing succeeds, settle the payment
        settlement = sdk.x402_payment_manager.settle_payment_with_facilitator(
            x402_payment={"x_payment_header": x_payment},
            payment_requirements=requirements
        )
        
        if not settlement.get("success"):
            raise HTTPException(402, detail={
                "error": "Payment settlement failed",
                "details": "Service completed but payment failed"
            })
        
        # 4. Return result with payment receipt
        return {
            **result,
            "payment_receipt": {
                "txHash": settlement.get("txHash"),
                "amount": settlement.get("amount"),
                "fee": settlement.get("fee"),
                "net": settlement.get("net")
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # If service processing fails, don't settle
        raise HTTPException(500, detail={"error": str(e)})

@app.get("/api/generate-image")
async def generate_image(x_payment: str = Header(None, alias="X-PAYMENT")):
    """Image Generation - $0.50 USDC"""
    
    if not x_payment:
        requirements = sdk.x402_payment_manager.create_payment_requirements(
            to_agent="MyAIAgent",
            amount_usdc=0.50,
            service_description="Image Generation"
        )
        
        raise HTTPException(
            status_code=402,
            detail={
                "x402Version": 1,
                "accepts": [{"scheme": "exact", "network": "base-sepolia", "asset": requirements.asset}],
                "paymentRequirements": requirements.model_dump(),
                "facilitator": {
                    "verify": "https://facilitator.chaoscha.in/verify",
                    "settle": "https://facilitator.chaoscha.in/settle"
                }
            }
        )
    
    # Correct x402 flow: Verify → Process → Settle
    try:
        requirements = sdk.x402_payment_manager.create_payment_requirements(
            to_agent="MyAIAgent",
            amount_usdc=0.50,
            service_description="Image Generation"
        )
        
        # 1. Verify payment
        verify_result = sdk.x402_payment_manager.verify_payment_with_facilitator(
            x402_payment={"x_payment_header": x_payment},
            payment_requirements=requirements
        )
        
        if not verify_result.get("isValid"):
            raise HTTPException(402, detail={"error": "Invalid payment"})
        
        # 2. Process request (your service logic)
        result = {
            "result": "Image generated",
            "imageUrl": "https://example.com/generated-image.png"
        }
        
        # 3. If processing succeeds, settle payment
        settlement = sdk.x402_payment_manager.settle_payment_with_facilitator(
            x402_payment={"x_payment_header": x_payment},
            payment_requirements=requirements
        )
        
        if not settlement.get("success"):
            raise HTTPException(402, detail={"error": "Settlement failed"})
        
        # 4. Return result with receipt
        return {
            **result,
            "payment_receipt": {
                "txHash": settlement.get("txHash"),
                "amount": settlement.get("amount"),
                "fee": settlement.get("fee"),
                "net": settlement.get("net")
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail={"error": str(e)})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)
    print("💰 Paywall server running on http://localhost:3000")
```

### Environment Variables

```bash
# Required
X402_USE_FACILITATOR=true
X402_FACILITATOR_URL=https://facilitator.chaoscha.in

# Optional
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
CHAOSCHAIN_OPERATOR_PRIVATE_KEY=0x...  # Your wallet private key (for receiving payments)
```

### Key Benefits

- ✅ **SDK handles EIP-3009 signing** - No manual signature creation needed
- ✅ **Facilitator integration built-in** - Just set environment variables
- ✅ **Multi-network support** - Works on Base, Ethereum, Optimism, Linea, Hedera, 0G
- ✅ **Automatic unit conversion** - SDK converts human amounts (1.00 USDC) to base units (1000000)
- ✅ **Built-in idempotency** - Replay protection handled automatically

**That's it!** The Python SDK handles all the complexity - just focus on building your service! 🚀

---

## Understanding Payment Requirements

### Amount Format

All amounts are in **base units** (smallest denomination):
- 1 USDC = `"1000000"` (6 decimals)
- 10 USDC = `"10000000"`

The SDK handles this conversion for you:
```typescript
// SDK converts human amount to base units
paymentManager.createPaymentRequirements(
  1.00,  // Human-readable: 1 USDC
  'USDC',
  'Service',
  '/api/service'
);
// Returns: { maxAmountRequired: "1000000", ... }
```

### Example 402 Response

```json
{
  "x402Version": 1,
  "accepts": [{
    "scheme": "exact",
    "network": "base-sepolia",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
  }],
  "paymentRequirements": {
    "scheme": "exact",
    "network": "base-sepolia",
    "maxAmountRequired": "1000000",
    "resource": "/api/service",
    "description": "AI Analysis Service",
    "payTo": "0xYourWalletAddress",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "maxTimeoutSeconds": 60
  },
  "facilitator": {
    "verify": "https://facilitator.chaoscha.in/verify",
    "settle": "https://facilitator.chaoscha.in/settle"
  }
}
```

---

## Fee Structure & Earnings

**Simple flat rate:** 1% for everyone, no API keys, no signup.

| Your Price | Facilitator Fee | You Receive |
|------------|-----------------|-------------|
| $100       | $1.00 (1%)      | $99.00      |
| $10        | $0.10 (1%)      | $9.90       |
| $1         | $0.01 (1%)      | $0.99       |

**Why so simple?**
- No account creation needed
- No rate limits or tiers
- Just works, like PayAI

**Example settlement response:**
```json
{
  "success": true,
  "txHash": "0x1234...",
  "amount": {
    "human": "1.00",
    "base": "1000000",
    "symbol": "USDC"
  },
  "fee": {
    "human": "0.01",
    "base": "10000",
    "bps": 100
  },
  "net": {
    "human": "0.99",
    "base": "990000"
  }
}
```

---

## Payment Flow (Complete)

```
Client                      Merchant Server              Facilitator                 Blockchain
  |                               |                            |                            |
  |--GET /api/service------------>|                            |                            |
  |                               |                            |                            |
  |<--402 Payment Required--------|                            |                            |
  |   (with payment requirements) |                            |                            |
  |                               |                            |                            |
  |--Sign EIP-3009 authorization--|                            |                            |
  |  (off-chain, gasless)         |                            |                            |
  |                               |                            |                            |
  |--GET /api/service------------>|                            |                            |
  |  (with X-PAYMENT header)      |                            |                            |
  |                               |                            |                            |
  |                               |--POST /verify------------->|                            |
  |                               |<--{ isValid: true }--------|                            |
  |                               |                            |                            |
  |                               |--POST /settle------------->|                            |
  |                               |                            |--transferWithAuthorization->|
  |                               |                            |   (EIP-3009, gasless)      |
  |                               |                            |<--tx confirmed--------------|
  |                               |<--{ success: true, txHash }|                            |
  |                               |                            |                            |
  |<--200 OK (service result)-----|                            |                            |
  |   (with payment receipt)      |                            |                            |
```

**Key Points:**
- Client signs ONE EIP-3009 authorization (off-chain, no gas)
- NO separate `approve()` transaction needed
- Facilitator pays gas, not client or merchant
- Settlement is atomic: merchant + treasury paid in one tx

---

## Testing Your Paywall

### 1. Get Testnet USDC

- **Base Sepolia:** https://faucet.circle.com/
- **Ethereum Sepolia:** https://faucet.circle.com/

### 2. Start Your Server

```bash
# TypeScript
MERCHANT_PRIVATE_KEY=0x... \
FACILITATOR_URL=https://facilitator.chaoscha.in \
npm start

# Python
MERCHANT_PRIVATE_KEY=0x... \
FACILITATOR_URL=https://facilitator.chaoscha.in \
python server.py
```

### 3. Test Without Payment (Should Return 402)

```bash
curl http://localhost:3000/api/analyze
```

**Expected Response:** 402 with payment requirements

### 4. Test With Payment (Using ChaosChain SDK as Client)

```typescript
import { X402PaymentManager, WalletManager } from '@chaoschain/sdk';
import { ethers } from 'ethers';

// Client setup
const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
const clientWallet = new WalletManager(
  { privateKey: process.env.CLIENT_PRIVATE_KEY },
  provider
);

const clientPaymentManager = new X402PaymentManager(
  clientWallet.getWallet(),
  'base-sepolia',
  {
    facilitatorUrl: 'https://facilitator.chaoscha.in',
    mode: 'managed'
  }
);

// 1. Get payment requirements from merchant
const response402 = await fetch('http://localhost:3000/api/analyze');
const { paymentRequirements } = await response402.json();

// 2. Generate payment authorization (EIP-3009)
const nonce = ethers.hexlify(ethers.randomBytes(32));
const now = BigInt(Math.floor(Date.now() / 1000));

const authParams = {
  from: clientWallet.getAddress(),
  to: paymentRequirements.payTo,
  value: BigInt(paymentRequirements.maxAmountRequired),
  validAfter: now,
  validBefore: now + BigInt(3600), // Valid for 1 hour
  nonce
};

const signature = await clientPaymentManager.signTransferAuthorization(authParams);

// 3. Create payment header
const paymentHeader = {
  from: clientWallet.getAddress(),
  to: paymentRequirements.payTo,
  value: authParams.value.toString(),
  validAfter: authParams.validAfter.toString(),
  validBefore: authParams.validBefore.toString(),
  nonce,
  signature
};

// 4. Make request with payment
const paidResponse = await fetch('http://localhost:3000/api/analyze', {
  headers: {
    'X-PAYMENT': Buffer.from(JSON.stringify(paymentHeader)).toString('base64')
  }
});

const result = await paidResponse.json();
console.log('✅ Service response:', result);
console.log('📝 Payment receipt:', result.payment_receipt);
```

---

## Production Checklist

Before going live on mainnet:

- [ ] Test complete flow on Base Sepolia
- [ ] Update `payTo` address to your production wallet
- [ ] Set `network` to `base-mainnet`
- [ ] Set `FACILITATOR_URL` to `https://facilitator.chaoscha.in`
- [ ] Add error handling for failed payments
- [ ] Implement payment receipt storage
- [ ] Add monitoring/logging for transactions
- [ ] Set up alerts for failed settlements
- [ ] Test idempotency (replay protection)
- [ ] Review Terms of Service: [TERMS.md](./TERMS.md)
- [ ] Ensure private keys are in secure environment variables

---

## Security Best Practices

### 1. Never Expose Private Keys

```typescript
// ❌ Bad
const privateKey = '0x123...';

// ✅ Good
const privateKey = process.env.MERCHANT_PRIVATE_KEY;
if (!privateKey) throw new Error('MERCHANT_PRIVATE_KEY not set');
```

### 2. Validate Payment Amounts

```typescript
// Always check the verified amount matches your expectation
if (verifyData.amount.base !== expectedAmount) {
  return res.status(402).json({ error: 'Incorrect payment amount' });
}
```

### 3. Implement Idempotency

```typescript
// Use Idempotency-Key header to prevent replay attacks
headers: {
  'Idempotency-Key': `${resource}_${paymentHeader.nonce}`
}
```

The facilitator automatically handles idempotency - repeated requests with the same payment will return the same cached response.

### 4. Always Use Facilitator for Verification

- ✅ Always verify payments through the facilitator
- ❌ Never trust client-provided payment proofs without verification
- ✅ Use HTTPS in production
- ✅ Validate payment header format before sending to facilitator

### 5. Monitor Facilitator Health

```typescript
// Check facilitator health before critical operations
const healthCheck = await fetch('https://facilitator.chaoscha.in/health');
const health = await healthCheck.json();

if (!health.healthy) {
  // Implement fallback or alert
  console.error('Facilitator unhealthy:', health);
}
```

---

## Benefits vs Traditional x402

| Feature | Traditional x402 | ChaosChain x402 |
|---------|-----------------|-----------------|
| Payment settlement | You handle on-chain | Facilitator handles |
| Gas fees | Payer pays ETH | Facilitator pays (gasless) |
| Approval needed | Yes (`approve()`) | No (EIP-3009 signature) |
| Agent identity | Manual | Automatic (ERC-8004) |
| Reputation tracking | None | Built-in (ValidationRegistry) |
| Multi-chain | Complex setup | Simple config change |
| Decentralization | Centralized only | Managed + CRE options |

---

## Advanced: Agent Identity Integration

Link payments to your ERC-8004 agent identity for reputation accrual:

```typescript
// Register your agent (one-time)
const agentId = await sdk.registerAgent({
  name: 'MyAIAgent',
  domain: 'myagent.ai',
  capabilities: ['analysis', 'prediction'],
});

console.log('Agent registered:', agentId); // e.g., "8004#123"

// Include agentId in all settlements
const settlement = await settlePayment(paymentHeader, requirements, {
  agentId: agentId.toString(),
});

// Payment is now linked to your agent identity
console.log('Evidence hash:', settlement.evidenceHash);
console.log('Proof of agency:', settlement.proofOfAgency);
```

**Benefits:**
- Every payment builds verifiable on-chain reputation
- Clients can check your payment history
- Automatic fraud detection via ValidationRegistry
- Portable reputation across platforms

---

## Troubleshooting

### "Payment verification failed"
- Check that `payTo` address matches your wallet
- Verify network matches (base-sepolia vs base-mainnet)
- Ensure amount in payment matches requirements

### "Invalid signature"
- Client may be using wrong network or wrong USDC contract
- Check that client is signing EIP-3009 authorization correctly
- Verify nonce hasn't been used before (replay protection)

### "Nonce already used"
- Payment has already been processed (idempotency protection)
- Client needs to generate a new nonce for a new payment

### "Settlement timeout"
- Network congestion, retry with exponential backoff
- Check facilitator health: https://facilitator.chaoscha.in/health
- Verify RPC endpoint is responding

### "Insufficient USDC balance"
- Client doesn't have enough USDC
- Check client balance on block explorer

---

## Environment Variables Reference

```bash
# Merchant Configuration
MERCHANT_PRIVATE_KEY=0x...              # Your wallet private key (REQUIRED)
FACILITATOR_URL=https://facilitator.chaoscha.in  # Facilitator endpoint (REQUIRED)
AGENT_ID=8004#123                       # Optional: your ERC-8004 agent ID

# Network Configuration
RPC_URL=https://sepolia.base.org        # For testnet
# RPC_URL=https://base.org              # For mainnet
NETWORK=base-sepolia                    # or 'base-mainnet'

# Server Configuration
PORT=3000
HOST=0.0.0.0
```

---

## Examples

Full working examples in this repo:
- `examples/ts-demo/` - TypeScript Express server
- `examples/py-demo/` - Python FastAPI server
- See also: [ChaosChain SDK examples](https://github.com/ChaosChain/chaoschain-sdk-ts/tree/main/examples)

---

## Support

Need help?
- **Documentation:** https://docs.chaoscha.in
- **GitHub Issues:** https://github.com/ChaosChain/chaoschain-x402/issues
- **SDK (TypeScript):** https://github.com/ChaosChain/chaoschain-sdk-ts
- **SDK (Python):** https://github.com/ChaosChain/chaoschain
- **Email:** sumeet.chougule@nethermind.io

---

**Ready to start earning? Deploy your first paid AI service today with ChaosChain x402!**
