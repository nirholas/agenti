# x402 Transfer Contract

Sponsored payment transfers for Aptos using fee payer mechanism.

## Overview

The x402 Transfer Contract enables gasless payments where:
- **Users** sign and authorize transfers from their accounts
- **Facilitators** pay transaction gas fees via Aptos fee payer mechanism
- **Multi-recipient splits** allow platform fees and artist payments in one transaction

## Features

### Security
- ✅ **Nonce-based replay protection** - Each nonce can only be used once
- ✅ **Time-based expiration** - Authorizations expire after `valid_until` timestamp
- ✅ **Chain ID validation** - Prevents cross-network replay attacks
- ✅ **Overflow protection** - Safe arithmetic for split transfers
- ✅ **Duplicate recipient detection** - Prevents accidental double payments
- ✅ **Formal verification** - Move Prover specifications included

### Functions

#### 1. Initialize Registry
```move
public entry fun initialize_registry(account: &signer)
```
Must be called once per account before using x402 transfers.

#### 2. Direct Transfer (User Pays Gas)
```move
public entry fun transfer_direct(
    user: &signer,
    to: address,
    amount: u64,
    nonce: vector<u8>,
)
```
User submits transaction and pays their own gas.

#### 3. Sponsored Transfer (Recommended)
```move
public entry fun transfer_sponsored(
    user: &signer,
    to: address,
    amount: u64,
    nonce: vector<u8>,
    valid_until: u64,
    chain_id: u8,
)
```
User is the signer, facilitator pays gas via fee payer mechanism.

**Parameters:**
- `user`: The account transferring funds
- `to`: Recipient address
- `amount`: Amount in octas (1 APT = 100,000,000 octas)
- `nonce`: Unique identifier (prevents replay)
- `valid_until`: Unix timestamp expiration
- `chain_id`: 1=mainnet, 2=testnet, 3=devnet

#### 4. Sponsored Split Transfer (Recommended for Platforms)
```move
public entry fun transfer_sponsored_split(
    user: &signer,
    recipients: vector<address>,
    amounts: vector<u64>,
    nonce: vector<u8>,
    valid_until: u64,
    chain_id: u8,
)
```
Split payment to multiple recipients (e.g., artist + platform fee).

**Example: $1.00 payment with 1.5% platform fee**
```
recipients = [artist_address, platform_address]
amounts = [98500000, 1500000]  // 0.985 APT + 0.015 APT
```

**Constraints:**
- Maximum 10 recipients
- No duplicate recipients
- All amounts must be positive
- Total must not overflow u64

### View Functions

#### Check if Nonce Used
```move
#[view]
public fun is_nonce_used(account: address, nonce: vector<u8>): bool
```

#### Check if Registry Initialized
```move
#[view]
public fun is_registry_initialized(account: address): bool
```

## Usage

### 1. Setup
```bash
# Initialize user's nonce registry
aptos move run \
  --function-id 'daudio::x402_transfer::initialize_registry'
```

### 2. Single Recipient Payment
```bash
# User signs, facilitator pays gas
aptos move run \
  --function-id 'daudio::x402_transfer::transfer_sponsored' \
  --args \
    address:0xRECIPIENT \
    u64:100000000 \
    "hex:6e6f6e63652d31" \
    u64:1700000000 \
    u8:2
```

### 3. Platform Payment with Fee Split
```bash
# Artist gets 98.5%, platform gets 1.5%
aptos move run \
  --function-id 'daudio::x402_transfer::transfer_sponsored_split' \
  --args \
    'address:[0xARTIST,0xPLATFORM]' \
    'u64:[98500000,1500000]' \
    "hex:6e6f6e63652d32" \
    u64:1700000000 \
    u8:2
```

## Development

### Compile
```bash
aptos move compile --skip-fetch-latest-git-deps
```

### Test
```bash
aptos move test --skip-fetch-latest-git-deps
```

**Test Coverage:**
- ✅ Registry initialization
- ✅ Nonce checking
- ✅ Sponsored transfers
- ✅ Split transfers
- ✅ Expiration validation
- ✅ Zero address rejection
- ✅ Duplicate recipient detection
- ✅ Too many recipients rejection

**Test Results:**
```
Test result: OK. Total tests: 8; passed: 8; failed: 0
```

### Deploy
```bash
aptos move publish --skip-fetch-latest-git-deps
```

## Error Codes

| Code | Constant | Description |
|------|----------|-------------|
| 2 | `E_NONCE_ALREADY_USED` | Nonce has been used before |
| 3 | `E_INSUFFICIENT_BALANCE` | User has insufficient APT |
| 4 | `E_INVALID_AMOUNT` | Amount is zero or invalid |
| 7 | `E_REGISTRY_NOT_INITIALIZED` | Must call `initialize_registry` first |
| 8 | `E_AMOUNTS_MISMATCH` | Recipients and amounts length mismatch |
| 9 | `E_ZERO_RECIPIENTS` | Recipients vector is empty |
| 10 | `E_AUTHORIZATION_EXPIRED` | Current time exceeds `valid_until` |
| 11 | `E_TOO_MANY_RECIPIENTS` | More than 10 recipients |
| 12 | `E_DUPLICATE_RECIPIENT` | Same address appears multiple times |
| 13 | `E_INVALID_CHAIN_ID` | Invalid chain ID |
| 14 | `E_TOTAL_AMOUNT_OVERFLOW` | Sum of amounts exceeds u64::MAX |
| 15 | `E_INVALID_RECIPIENT_ADDRESS` | Recipient is zero address |

## Events

### TransferWithAuthorizationEvent
Emitted for single-recipient transfers:
```move
struct TransferWithAuthorizationEvent {
    from: address,
    to: address,
    amount: u64,
    nonce: vector<u8>,
    facilitator: address,
    timestamp: u64,
}
```

### TransferWithSplitEvent
Emitted for multi-recipient transfers:
```move
struct TransferWithSplitEvent {
    from: address,
    recipients: vector<address>,
    amounts: vector<u64>,
    total_amount: u64,
    nonce: vector<u8>,
    facilitator: address,
    timestamp: u64,
}
```

## Security Audit

See [SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md) for detailed security analysis.

**Key Findings:**
- ✅ All critical vulnerabilities have been resolved
- ✅ Deprecated functions removed
- ✅ Production-ready implementation

## Move Prover

Formal verification specifications included. See [PROVER_README.md](./PROVER_README.md).

## Architecture

### Fee Payer Mechanism

The contract uses Aptos's native fee payer mechanism:

1. User creates transaction with `transfer_sponsored` or `transfer_sponsored_split`
2. User signs transaction as primary signer
3. Facilitator adds themselves as fee payer (secondary signer)
4. Transaction executes:
   - User's funds are transferred (user is signer)
   - Facilitator pays gas fees (fee payer)

### Nonce Management

Each user maintains their own `NonceRegistry`:
- Nonces are arbitrary byte vectors (no specific format required)
- Once used, a nonce is permanently marked in the SmartTable
- Nonces are checked atomically before any state changes

### Replay Protection

Multiple layers of replay protection:
1. **Nonce** - Prevents same transaction twice
2. **Chain ID** - Prevents cross-network replay
3. **Timestamp** - Prevents stale authorizations

## Deployment

### Prerequisites
```bash
aptos --version  # >= 7.0.0
```

### Testnet Deployment

1. Update `Move.toml` with your address:
```toml
[addresses]
x402_transfer = "YOUR_ADDRESS"
daudio = "YOUR_ADDRESS"
```

2. Compile and test:
```bash
aptos move compile --skip-fetch-latest-git-deps
aptos move test --skip-fetch-latest-git-deps
```

3. Deploy:
```bash
aptos move publish --named-addresses daudio=YOUR_ADDRESS
```

### Mainnet Deployment

**⚠️ Security audit completed - production ready**

```bash
aptos move publish \
  --profile mainnet \
  --named-addresses daudio=YOUR_ADDRESS
```

## Current Deployments

### Testnet
```
Contract Address: 0xc7e1ae48502e9d236288827ade5ac916ccd7454f2136856cdf002820494c7f36
Network: Aptos Testnet
```

## License

See [LICENSE](../../LICENSE)

## Support

For issues and questions, see the main repository documentation.
