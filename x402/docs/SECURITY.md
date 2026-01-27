# x402 Security Best Practices

> Protect your AI agent's wallet and manage payment risks.

---

## Overview

When AI agents have access to funds, security is critical. This guide covers:

- Private key management
- Payment limits and controls
- Allowlisting and blocklisting
- Auditing and monitoring
- Recovery procedures

---

## Private Key Management

### ⚠️ Critical Rules

```
┌─────────────────────────────────────────────────────────────┐
│                   NEVER DO THESE                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ✗ Store private keys in code                              │
│   ✗ Commit private keys to git                              │
│   ✗ Share private keys in logs/errors                       │
│   ✗ Use your main wallet for AI agents                      │
│   ✗ Store more than needed in hot wallets                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Best Practices

#### 1. Use Dedicated Agent Wallets

```bash
# Create a NEW wallet specifically for AI agent use
# Don't reuse your personal or main wallets

# Generate new wallet
node -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))"

# Store this in a secure location, NOT in code
```

#### 2. Environment Variable Storage

```bash
# Good: Environment variable
export X402_PRIVATE_KEY=0x...

# Better: Secrets manager
export X402_PRIVATE_KEY=$(vault kv get -field=key secret/ai-agent)

# Best: Hardware security module (HSM)
# Use AWS KMS, Google Cloud KMS, or similar
```

#### 3. Configuration File Security

```json
// claude_desktop_config.json
{
  "mcpServers": {
    "universal-crypto-mcp": {
      "command": "npx",
      "args": ["-y", "@nirholas/universal-crypto-mcp@latest"],
      "env": {
        // Reference environment variable, don't hardcode
        "X402_PRIVATE_KEY": "${X402_PRIVATE_KEY}"
      }
    }
  }
}
```

#### 4. Key Rotation

```typescript
// Rotate keys periodically
// 1. Generate new wallet
// 2. Transfer funds from old to new
// 3. Update configuration
// 4. Verify new wallet works
// 5. Secure/destroy old key

async function rotateWallet() {
  const oldAddress = await x402_address();
  const balance = await x402_balance();
  
  // Generate new key (externally)
  const newAddress = "0xNewWallet...";
  
  // Transfer all funds
  await x402_send({
    to: newAddress,
    amount: balance.usds,
    token: "USDs"
  });
  
  // Update X402_PRIVATE_KEY to new key
  // Verify access to new wallet
}
```

---

## Payment Limits

### Configure Maximum Payments

```bash
# Limit per-request payments
export X402_MAX_PAYMENT=1.00  # Max $1.00 per request

# For high-value operations
export X402_MAX_PAYMENT=10.00  # Max $10.00 per request

# For testing
export X402_MAX_PAYMENT=0.01  # Max $0.01 per request
```

### Tiered Limits

```typescript
// Implement tiered limits based on action type
const PAYMENT_LIMITS = {
  "weather-api": 0.10,      // Max 10 cents for weather
  "image-generation": 0.50,  // Max 50 cents for images
  "research-report": 5.00,   // Max $5 for research
  "default": 0.25            // Default max
};

function getMaxPayment(url: string): number {
  for (const [pattern, limit] of Object.entries(PAYMENT_LIMITS)) {
    if (url.includes(pattern)) {
      return limit;
    }
  }
  return PAYMENT_LIMITS.default;
}
```

### Daily/Weekly Budgets

```typescript
// Track spending over time
class SpendingTracker {
  private dailySpent: number = 0;
  private dailyLimit: number = 10.00;  // $10/day
  private lastReset: Date = new Date();
  
  async canSpend(amount: number): Promise<boolean> {
    this.maybeReset();
    return (this.dailySpent + amount) <= this.dailyLimit;
  }
  
  async recordSpending(amount: number): void {
    this.maybeReset();
    this.dailySpent += amount;
  }
  
  private maybeReset(): void {
    const now = new Date();
    if (now.getDate() !== this.lastReset.getDate()) {
      this.dailySpent = 0;
      this.lastReset = now;
    }
  }
}
```

---

## Allowlisting Services

### URL Allowlist

```typescript
// Only allow payments to trusted URLs
const ALLOWED_DOMAINS = [
  "api.weather.io",
  "api.imageai.io",
  "api.trusted-service.com",
  "*.coinbase.com"  // Wildcard support
];

function isAllowedUrl(url: string): boolean {
  const urlObj = new URL(url);
  return ALLOWED_DOMAINS.some(domain => {
    if (domain.startsWith("*.")) {
      return urlObj.hostname.endsWith(domain.slice(1));
    }
    return urlObj.hostname === domain;
  });
}

// Use in payment flow
async function safePay(url: string, maxPayment: string) {
  if (!isAllowedUrl(url)) {
    throw new Error(`Domain not in allowlist: ${new URL(url).hostname}`);
  }
  return x402_pay_request({ url, maxPayment });
}
```

### Recipient Address Allowlist

```typescript
// Only pay to known wallet addresses
const ALLOWED_RECIPIENTS = new Set([
  "0xWeatherAPIWallet1234...",
  "0xImageServiceWallet5678...",
  "0xTrustedPartnerWalletABCD..."
]);

function isAllowedRecipient(address: string): boolean {
  return ALLOWED_RECIPIENTS.has(address);
}
```

### Blocklist Patterns

```typescript
// Block suspicious patterns
const BLOCKED_PATTERNS = [
  /phishing/i,
  /scam/i,
  /airdrop-claim/i,
  /free-crypto/i,
  /connect-wallet/i
];

function isSuspiciousUrl(url: string): boolean {
  return BLOCKED_PATTERNS.some(pattern => pattern.test(url));
}
```

---

## Auditing Payments

### Comprehensive Logging

```typescript
interface PaymentLog {
  timestamp: string;
  action: "estimate" | "pay" | "send";
  url?: string;
  recipient?: string;
  amount: string;
  token: string;
  txHash?: string;
  status: "success" | "failed" | "rejected";
  reason?: string;
}

class PaymentAuditor {
  private logs: PaymentLog[] = [];
  
  log(entry: Omit<PaymentLog, "timestamp">) {
    const log: PaymentLog = {
      ...entry,
      timestamp: new Date().toISOString()
    };
    
    this.logs.push(log);
    
    // Also write to persistent storage
    this.persistLog(log);
    
    // Alert on suspicious activity
    this.checkForAlerts(log);
  }
  
  private persistLog(log: PaymentLog) {
    // Write to file, database, or logging service
    fs.appendFileSync(
      "/var/log/x402-payments.jsonl",
      JSON.stringify(log) + "\n"
    );
  }
  
  private checkForAlerts(log: PaymentLog) {
    // High-value transactions
    if (parseFloat(log.amount) > 1.00) {
      this.alert("High-value transaction", log);
    }
    
    // Failed transactions
    if (log.status === "failed") {
      this.alert("Transaction failed", log);
    }
    
    // Unusual patterns
    const recentLogs = this.logs.slice(-10);
    if (recentLogs.filter(l => l.status === "failed").length > 3) {
      this.alert("Multiple failed transactions", recentLogs);
    }
  }
  
  private alert(message: string, data: any) {
    // Send to monitoring system
    console.error(`[ALERT] ${message}`, data);
    // Could also: send email, Slack, PagerDuty, etc.
  }
}
```

### Transaction Monitoring

```typescript
// Monitor all transactions
async function monitoredPay(params: PayRequest): Promise<PayResponse> {
  const auditor = new PaymentAuditor();
  
  // Log attempt
  auditor.log({
    action: "pay",
    url: params.url,
    amount: params.maxPayment,
    token: "USDC",
    status: "pending"
  });
  
  try {
    const result = await x402_pay_request(params);
    
    // Log success
    auditor.log({
      action: "pay",
      url: params.url,
      amount: result.cost || params.maxPayment,
      token: "USDC",
      txHash: result.paymentMade,
      status: "success"
    });
    
    return result;
  } catch (error) {
    // Log failure
    auditor.log({
      action: "pay",
      url: params.url,
      amount: params.maxPayment,
      token: "USDC",
      status: "failed",
      reason: error.message
    });
    
    throw error;
  }
}
```

---

## Human-in-the-Loop

### Approval Thresholds

```typescript
// Require human approval for large transactions
const APPROVAL_THRESHOLD = 1.00;  // $1.00

async function payWithApproval(params: PayRequest): Promise<PayResponse> {
  const estimate = await x402_estimate({ url: params.url });
  
  if (parseFloat(estimate.price) > APPROVAL_THRESHOLD) {
    // Request human approval
    const approved = await requestHumanApproval({
      url: params.url,
      amount: estimate.price,
      description: estimate.description
    });
    
    if (!approved) {
      throw new Error("Payment rejected by user");
    }
  }
  
  return x402_pay_request(params);
}
```

### Approval Workflow

```
┌─────────────────────────────────────────────────────────────┐
│               Payment Approval Workflow                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────┐     ┌─────────┐     ┌─────────┐              │
│   │ Request │────▶│ Check   │────▶│ Amount  │              │
│   │ Payment │     │ Amount  │     │ < $1?   │              │
│   └─────────┘     └─────────┘     └────┬────┘              │
│                                        │                    │
│                        Yes ┌───────────┴───────────┐ No     │
│                            ▼                       ▼        │
│                   ┌─────────────┐          ┌─────────────┐  │
│                   │ Auto-approve│          │  Request    │  │
│                   │   & Pay     │          │  Approval   │  │
│                   └─────────────┘          └──────┬──────┘  │
│                                                   │         │
│                                    ┌──────────────┴─────┐   │
│                                    ▼                    ▼   │
│                             ┌──────────┐          ┌────────┐│
│                             │ Approved │          │Rejected││
│                             │   Pay    │          │ Cancel ││
│                             └──────────┘          └────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Wallet Hygiene

### 1. Minimum Balance Alerts

```typescript
const MINIMUM_BALANCE = 5.00;  // Alert if below $5

async function checkBalance() {
  const balance = await x402_balance();
  const usdBalance = parseFloat(balance.usds);
  
  if (usdBalance < MINIMUM_BALANCE) {
    await sendAlert({
      type: "low-balance",
      balance: usdBalance,
      wallet: balance.address,
      action: "Top up wallet to continue operations"
    });
  }
}

// Run periodically
setInterval(checkBalance, 60 * 60 * 1000);  // Every hour
```

### 2. Regular Balance Checks

```typescript
// Check balance before expensive operations
async function ensureSufficientBalance(requiredAmount: number) {
  const balance = await x402_balance();
  const available = parseFloat(balance.usds);
  
  if (available < requiredAmount) {
    throw new Error(
      `Insufficient balance: have $${available}, need $${requiredAmount}`
    );
  }
}
```

### 3. Sweep Excess Funds

```typescript
// Don't keep more than needed in hot wallet
const MAX_HOT_WALLET_BALANCE = 100.00;
const COLD_WALLET = "0xYourColdWallet...";

async function sweepExcessFunds() {
  const balance = await x402_balance();
  const usdBalance = parseFloat(balance.usds);
  
  if (usdBalance > MAX_HOT_WALLET_BALANCE) {
    const excess = usdBalance - MAX_HOT_WALLET_BALANCE;
    await x402_send({
      to: COLD_WALLET,
      amount: excess.toFixed(2),
      token: "USDs"
    });
  }
}
```

---

## Recovery Procedures

### 1. Compromised Key Response

```
┌─────────────────────────────────────────────────────────────┐
│           Key Compromise Response Plan                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   1. IMMEDIATELY revoke any token approvals                 │
│      - Use x402_approve with amount=0 to revoke             │
│                                                             │
│   2. Transfer remaining funds to secure wallet              │
│      - Move all tokens to cold storage                      │
│                                                             │
│   3. Generate new wallet                                    │
│      - Create fresh key pair                                │
│      - Store securely                                       │
│                                                             │
│   4. Update configurations                                  │
│      - Update X402_PRIVATE_KEY everywhere                   │
│      - Restart all services                                 │
│                                                             │
│   5. Audit damage                                           │
│      - Check transaction history                            │
│      - Document any unauthorized transactions               │
│                                                             │
│   6. Report if needed                                       │
│      - File reports with exchanges if funds moved there     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. Emergency Stop

```typescript
// Kill switch for all payments
class EmergencyStop {
  private static stopped = false;
  
  static stop() {
    this.stopped = true;
    console.error("[EMERGENCY] All payments stopped");
  }
  
  static resume() {
    this.stopped = false;
    console.log("[EMERGENCY] Payments resumed");
  }
  
  static isActive(): boolean {
    return this.stopped;
  }
}

// Use in payment flow
async function safePay(params: PayRequest) {
  if (EmergencyStop.isActive()) {
    throw new Error("Payments are currently disabled");
  }
  return x402_pay_request(params);
}
```

---

## Security Checklist

### Before Deployment

- [ ] Using dedicated agent wallet (not personal)
- [ ] Private key stored in secrets manager
- [ ] No keys in code or git
- [ ] Payment limits configured
- [ ] URL allowlist set up
- [ ] Logging enabled
- [ ] Alerts configured
- [ ] Recovery plan documented

### Ongoing Monitoring

- [ ] Daily balance checks
- [ ] Transaction audit review
- [ ] Suspicious activity alerts
- [ ] Key rotation schedule
- [ ] Allowlist updates

### Incident Response

- [ ] Emergency stop procedure tested
- [ ] Recovery steps documented
- [ ] Contact list for incidents
- [ ] Backup wallet ready

---

## Additional Resources

- [EIP-3009 Specification](https://eips.ethereum.org/EIPS/eip-3009) - Transfer authorization standard
- [OWASP Cryptographic Guidelines](https://owasp.org/www-project-cryptographic-storage-cheat-sheet/)
- [MCP Security Guide](https://modelcontextprotocol.io/security)

---

<p align="center">
  <b>Security is not optional when money is involved.</b><br>
  Take time to implement these practices before deploying.
</p>
