# Exact Payment Scheme for Starknet (`exact`)

This document specifies the `exact` payment scheme for the x402 protocol v2 on Starknet.

This scheme facilitates payments of a specific amount of an ERC20 token on the Starknet blockchain using gasless transactions sponsored by a paymaster.

## Scheme Name

`exact`

## Protocol Flow

The protocol flow for `exact` on Starknet is client-driven with paymaster sponsorship.

1. **Client** makes an HTTP request to a **Resource Server**.
2. **Resource Server** responds with a `402 Payment Required` status. The response includes the `PAYMENT-REQUIRED` header (base64-encoded) or body containing `PaymentRequired` with `accepts` array for the `exact` scheme.
3. **Client** queries a **Paymaster Service** to build a gasless transaction containing a transfer of the specified asset to the resource server's wallet address.
4. **Paymaster Service** constructs a typed data structure following the SNIP-12 standard for the transfer transaction.
5. **Client** signs the typed data with their Starknet account. This creates a signature that authorizes the transaction.
6. **Client** creates the payment payload containing the signature, authorization parameters, and accepted payment option.
7. **Client** sends a new HTTP request to the resource server with the `PAYMENT-SIGNATURE` header containing the Base64-encoded payment payload.
8. **Resource Server** receives the request and forwards the `PAYMENT-SIGNATURE` header and `PaymentRequirements` to a **Facilitator Server's** `/verify` endpoint.
9. **Facilitator** decodes and validates the payment payload:
   - Verifies payload structure
   - Verifies signature is valid (via SNIP-6 `isValidSignature`)
   - Verifies client has sufficient balance
   - Verifies payment amount matches requirements
   - Verifies payment hasn't expired
   - Verifies network, asset, and recipient match
10. **Facilitator** returns a response to the **Resource Server** verifying the **client** payment.
11. **Resource Server**, upon successful verification, forwards the payload to the facilitator's `/settle` endpoint.
12. **Facilitator Server** submits the signed transaction to the **Paymaster Service**, which sponsors the gas and broadcasts it to the Starknet network.
13. Upon successful on-chain settlement, the **Facilitator Server** responds to the **Resource Server** with the transaction hash.
14. **Resource Server** grants the **Client** access to the resource in its response.

## `PaymentRequirements` for `exact`

The `exact` scheme on Starknet uses the standard x402 v2 `PaymentRequirements` fields:

```json
{
  "scheme": "exact",
  "network": "starknet:sepolia",
  "amount": "1000000",
  "asset": "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
  "payTo": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "resource": "https://api.example.com/data",
  "description": "Access to premium API features",
  "mimeType": "application/json",
  "maxTimeoutSeconds": 300,
  "extra": {
    "tokenName": "Ether",
    "tokenSymbol": "ETH",
    "tokenDecimals": 18
  }
}
```

### Field Definitions

- `scheme`: Must be `"exact"`
- `network`: Network identifier in CAIP-2 format. Valid values:
  - `"starknet:mainnet"` - Starknet mainnet (chain ID: `0x534e5f4d41494e`)
  - `"starknet:sepolia"` - Starknet Sepolia testnet (chain ID: `0x534e5f5345504f4c4941`)
  - `"starknet:devnet"` - Local development network
- `amount`: Payment amount (as decimal string, not hex) in the smallest unit of the token
- `asset`: Contract address of the ERC20 token
- `payTo`: Recipient address (resource server's wallet)
- `resource`: URL or URI of the protected resource (string or ResourceInfo object)
- `description`: Optional human-readable description of the payment
- `mimeType`: Optional MIME type of the resource
- `maxTimeoutSeconds`: Required maximum timeout in seconds for settlement
- `extra`: Optional metadata object containing:
  - `tokenName`: Token name (e.g., "Ether")
  - `tokenSymbol`: Token symbol (e.g., "ETH")
  - `tokenDecimals`: Number of decimals (e.g., 18)
  - Additional custom fields as needed

## `PAYMENT-SIGNATURE` Header Payload

The `PAYMENT-SIGNATURE` header is base64 encoded and sent in the request from the client to the resource server when paying for a resource.

Once decoded, the `PAYMENT-SIGNATURE` header is a JSON string with the following properties:

```json
{
  "x402Version": 2,
  "scheme": "exact",
  "network": "starknet:sepolia",
  "accepted": {
    "scheme": "exact",
    "network": "starknet:sepolia",
    "amount": "1000000",
    "asset": "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
    "payTo": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "resource": "https://api.example.com/data",
    "maxTimeoutSeconds": 300
  },
  "payload": {
    "signature": {
      "r": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "s": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
    },
    "authorization": {
      "from": "0x857b06519e91e3a54538791bdbb0e22373e36b66",
      "to": "0x209693bc6afc0c5328ba36faf03c514ef312287c",
      "amount": "1000000",
      "token": "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
      "nonce": "0x1",
      "validUntil": "1740672154"
    }
  }
}
```

### v2 Payload Changes

The x402 v2 payload differs from v1:

- `x402Version`: Now `2` instead of `1`
- `accepted`: New field containing the accepted `PaymentRequirements` from the 402 response
- `network`: Uses CAIP-2 format (`starknet:sepolia` instead of `starknet-sepolia`)
- `amount`: Field name in requirements (previously `maxAmountRequired`)

### Signature Structure

The `signature` field contains a Starknet signature in `(r, s)` format:

- `r`: First component of the signature (hex string with `0x` prefix)
- `s`: Second component of the signature (hex string with `0x` prefix)

This differs from EVM's single hex string signature because Starknet uses a different elliptic curve (STARK-friendly curve) and signature scheme.

### Authorization Parameters

The `authorization` field contains parameters describing the authorized transfer:

- `from`: Payer's account address (hex string with `0x` prefix)
- `to`: Recipient's address (hex string with `0x` prefix)
- `amount`: Transfer amount as decimal string (not hex) in smallest token units
- `token`: ERC20 token contract address (hex string with `0x` prefix)
- `nonce`: Transaction nonce (hex string with `0x` prefix)
- `validUntil`: Unix timestamp (decimal string, not hex) after which the authorization expires

**Key differences from EVM:**

- Uses `amount` instead of `value` (clearer terminology)
- Uses single `validUntil` timestamp instead of `validAfter`/`validBefore` range
- Includes explicit `token` field (required for Starknet ERC20 transfers)
- Nonce is hex format (Starknet convention)
- `validUntil` is decimal string for easier timestamp comparison

## Paymaster Integration

The Starknet `exact` scheme relies on a paymaster service to sponsor gas fees for transactions. This enables true gasless payments where neither the client nor the resource server needs to hold ETH for gas.

### Paymaster Endpoints

Default paymaster endpoints per network:

- **Mainnet**: `https://starknet.paymaster.avnu.fi`
- **Sepolia**: `http://localhost:12777` (development)
- **Devnet**: `http://localhost:12777` (development)

The library provides utilities for paymaster configuration:

```typescript
import {
  createPaymasterConfig,
  createSettlementOptions,
  hasPublicPaymaster,
  DEFAULT_PAYMASTER_ENDPOINTS,
} from 'x402-starknet';

// Check if network has a default paymaster
if (hasPublicPaymaster('starknet:mainnet')) {
  console.log('Using default endpoint');
}

// Create paymaster configuration
const config = createPaymasterConfig('starknet:mainnet', {
  apiKey: process.env.PAYMASTER_API_KEY,
});

// Or create complete settlement options
const options = createSettlementOptions('starknet:mainnet', {
  endpoint: 'https://custom-paymaster.com', // Optional
  apiKey: process.env.PAYMASTER_API_KEY,
});
```

### Typed Data Structure

The paymaster constructs a SNIP-12 typed data structure for the transfer. The client signs this typed data, creating a signature that authorizes the transaction.

The typed data is stored alongside the payment payload for later use during settlement, but is **not included in the `PAYMENT-SIGNATURE` header** to minimize payload size. The facilitator reconstructs or caches the typed data separately.

## Facilitator Verification Rules (MUST)

A facilitator verifying an `exact`-scheme Starknet payment MUST enforce all of the following checks:

### 1. Payload Structure Validation

- Decode the base64 `PAYMENT-SIGNATURE` header
- Parse as JSON and validate against the schema
- Verify `x402Version` is `2`
- Verify `scheme` is `"exact"`
- Verify `network` matches CAIP-2 format: `starknet:mainnet`, `starknet:sepolia`, or `starknet:devnet`
- Verify `accepted` field contains valid `PaymentRequirements`
- Verify `payload.signature` contains valid `r` and `s` hex strings
- Verify `payload.authorization` contains all required fields

### 2. Network Compatibility

- Verify `payload.network` matches `paymentRequirements.network`
- Verify `payload.accepted.network` matches `paymentRequirements.network`
- Verify the RPC provider is connected to the correct network
- Map chain IDs to network identifiers:
  - `0x534e5f4d41494e` → `starknet:mainnet`
  - `0x534e5f5345504f4c4941` → `starknet:sepolia`
  - Other → `starknet:devnet`

### 3. Authorization Parameters

- Verify `payload.authorization.token` matches `paymentRequirements.asset`
- Verify `payload.authorization.to` matches `paymentRequirements.payTo`
- Verify `payload.authorization.amount` >= `paymentRequirements.amount`
- Normalize addresses before comparison (handle `0x1` vs `0x0001` equivalence)

### 4. Expiration Check

- Parse `payload.authorization.validUntil` as Unix timestamp
- Get current Unix timestamp
- Verify `currentTimestamp <= validUntil`
- Return error code `expired` if payment has expired

### 5. Signature Verification

- Extract the typed data hash from the signed transaction
- Call the account contract's `isValidSignature(hash, signature)` function (SNIP-6)
- The function returns `VALID` (0x56414c4944) if signature is valid
- This works with all account types:
  - OpenZeppelin accounts
  - Argent accounts
  - Braavos accounts
  - Custom account implementations
- Return error code `invalid_signature` if verification fails
- If typed data is not available, skip this check (will be verified during execution)

### 6. Balance Verification

- Query the payer's token balance using `balanceOf(account)` on the ERC20 contract
- Parse the balance as a 256-bit unsigned integer (u256)
- Verify `balance >= authorization.amount`
- Return error code `insufficient_funds` if balance is insufficient
- Include both `required` and `available` amounts in error details

### 7. Nonce Validation (Optional but Recommended)

- Maintain a server-side cache of used nonces per account
- Check if the nonce has been used before
- Return error code `invalid_nonce` if nonce is reused
- This prevents replay attacks

### 8. Amount Verification

- Verify the authorized amount is sufficient for the resource cost
- Verify the amount doesn't exceed reasonable limits (DoS prevention)
- Return error code `invalid_amount` if amount is invalid

## Settlement

Settlement is performed by the facilitator submitting the signed transaction to the Starknet network via a paymaster.

### Settlement Process

1. **Retrieve Typed Data**: The facilitator retrieves the typed data structure that was signed by the client (from cache or reconstruction)

2. **Submit to Paymaster**: The facilitator sends the following to the paymaster service:
   - The typed data structure
   - The client's signature (r, s)
   - The transfer call parameters

3. **Paymaster Execution**: The paymaster service:
   - Validates the signature
   - Constructs the transaction
   - Signs it with the paymaster's account (sponsors gas)
   - Broadcasts to Starknet network

4. **Transaction Confirmation**: Wait for transaction to be accepted on L2
   - Status: `ACCEPTED_ON_L2` or `ACCEPTED_ON_L1`
   - Returns transaction hash for verification

5. **Error Handling**: If settlement fails:
   - Return error code `settlement_failed`
   - Include transaction hash (if available) and error details
   - Log the failure for investigation

### Settlement Guarantees

- **Atomicity**: The transfer either completes fully or fails entirely (no partial transfers)
- **Gas Sponsorship**: The facilitator pays gas fees via paymaster (client pays nothing)
- **Finality**: Once `ACCEPTED_ON_L2`, the transaction is final
- **Recipient Guarantee**: Funds are sent directly to `paymentRequirements.payTo` (facilitator cannot redirect)

## Security Considerations

### Signature Verification

The facilitator MUST verify signatures using the account contract's `isValidSignature` function (SNIP-6) rather than performing raw ECDSA verification. This is critical because:

1. **Account Abstraction**: Starknet uses native account abstraction - there is no single signature scheme
2. **Multisig Support**: Many accounts require multiple signatures or use non-ECDSA schemes
3. **Upgradeable Logic**: Account contracts can upgrade their signature validation logic
4. **Standard Compliance**: SNIP-6 is the standard interface that all Starknet accounts implement

### Nonce Management

- Each nonce can only be used once per account
- Facilitators MUST track used nonces to prevent replay attacks
- Nonces should be invalidated immediately upon successful settlement
- Consider expiring unused nonces after `maxTimeoutSeconds`

### Amount Validation

- Always verify `amount >= paymentRequirements.amount`
- Consider setting maximum limits to prevent DoS attacks
- Validate amounts are within token's decimal precision
- Check for integer overflow/underflow

### Network Isolation

- Never mix transactions across networks (mainnet/sepolia/devnet)
- Validate chain IDs match expected network
- Use separate RPC providers per network
- Cache network information to prevent spoofing

### Balance Racing

- Balance checks are not atomic with settlement
- A user could submit multiple payments and drain their balance
- Facilitators should consider implementing:
  - Balance reservation systems
  - Rate limiting per account
  - Concurrent payment limits

### Paymaster Trust

- The facilitator trusts the paymaster service to execute transactions correctly
- Choose reputable paymaster providers
- Monitor for paymaster failures or censorship
- Consider fallback paymaster endpoints

## Error Codes

Following x402 spec section 9, these error codes are returned by verification and settlement:

### Verification Errors

- `invalid_network`: Network mismatch or invalid network identifier
- `invalid_amount`: Amount insufficient or invalid
- `insufficient_funds`: Payer has insufficient token balance
- `expired`: Payment has passed its `validUntil` timestamp
- `invalid_signature`: Signature verification failed
- `invalid_nonce`: Nonce has been used or is invalid

### Settlement Errors

- `settlement_failed`: On-chain transaction failed
- `unexpected_settle_error`: Unexpected error during settlement (should not happen)

### Response Format

Verification response:

```json
{
  "isValid": false,
  "invalidReason": "insufficient_funds",
  "payer": "0x857b06519e91e3a54538791bdbb0e22373e36b66",
  "details": {
    "required": "1000000",
    "available": "500000"
  }
}
```

Settlement response (success):

```json
{
  "success": true,
  "transaction": "0x1234567890abcdef...",
  "network": "starknet:sepolia",
  "payer": "0x857b06519e91e3a54538791bdbb0e22373e36b66"
}
```

Settlement response (failure):

```json
{
  "success": false,
  "errorReason": "settlement_failed",
  "transaction": "",
  "network": "starknet:sepolia",
  "payer": "0x857b06519e91e3a54538791bdbb0e22373e36b66"
}
```

## Implementation Notes

### Address Normalization

Starknet addresses can be represented in different formats:

- Short form: `0x1`
- Padded form: `0x0000000000000000000000000000000000000000000000000000000000000001`

Facilitators MUST normalize addresses before comparison by:

1. Removing `0x` prefix
2. Padding with leading zeros to 64 hex characters
3. Re-adding `0x` prefix
4. Converting to lowercase

### Timestamp Format

- `validUntil` is a Unix timestamp in **decimal string format** (not hex)
- Example: `"1740672154"` (not `"0x67a1234a"`)
- This matches JavaScript's `Date.now() / 1000` output
- Simplifies timestamp comparison and arithmetic

### Token Amounts

- Amounts are in the smallest unit of the token (like wei for ETH)
- Amounts are **decimal strings** (not hex)
- For tokens with 18 decimals: `1 ETH = "1000000000000000000"`
- Always use `BigInt` for amount arithmetic to prevent precision loss

The library provides utilities for working with tokens:

```typescript
import {
  ETH_ADDRESSES,
  STRK_ADDRESSES,
  USDC_ADDRESSES,
  getTokenAddress,
  getTokenDecimals,
  toAtomicUnits,
  fromAtomicUnits,
  isTokenAvailable,
  getAvailableTokens,
} from 'x402-starknet';

// Get token address for a network
const ethAddress = ETH_ADDRESSES['starknet:mainnet'];
// or: getTokenAddress('ETH', 'starknet:mainnet')

// Convert human amounts to atomic units
const atomicAmount = toAtomicUnits(1.5, 'USDC'); // '1500000' (6 decimals)
const ethAmount = toAtomicUnits(0.001, 'ETH'); // '1000000000000000' (18 decimals)

// Convert atomic units back to human-readable
const humanAmount = fromAtomicUnits('1500000', 'USDC'); // 1.5

// Check token availability
console.log(isTokenAvailable('USDC', 'starknet:mainnet')); // true
console.log(isTokenAvailable('USDC', 'starknet:sepolia')); // false

// Get all tokens for a network
const tokens = getAvailableTokens('starknet:mainnet'); // ['ETH', 'STRK', 'USDC']
```

### Chain ID Mapping

Map Starknet chain IDs to network identifiers:

```typescript
const chainId = await provider.getChainId();
switch (chainId) {
  case '0x534e5f4d41494e': // SN_MAIN
    return 'starknet:mainnet';
  case '0x534e5f5345504f4c4941': // SN_SEPOLIA
    return 'starknet:sepolia';
  default:
    return 'starknet:devnet'; // Unknown = devnet
}
```

The library provides utilities for network validation and conversion:

```typescript
import {
  isStarknetNetwork,
  validateNetwork,
  parseStarknetNetwork,
  STARKNET_NETWORKS,
} from 'x402-starknet';

// Type guard
if (isStarknetNetwork(userInput)) {
  // userInput is now typed as StarknetNetworkId
}

// Validate or throw
const network = validateNetwork(userInput);

// Parse CAIP-2 components
const { namespace, reference } = parseStarknetNetwork('starknet:mainnet');
// namespace = 'starknet', reference = 'mainnet'

// Iterate all supported networks
for (const network of STARKNET_NETWORKS) {
  console.log(network);
}
```

The library also provides a provider factory for creating RPC providers:

```typescript
import { createProvider, getChainId } from 'x402-starknet';
import { constants } from 'starknet';

// Create provider with default RPC URL
const provider = createProvider('starknet:sepolia');

// Create provider with custom RPC URL
const provider = createProvider('starknet:mainnet', {
  rpcUrl: 'https://your-rpc-endpoint.com',
  timeout: 60000,
});

// Get Starknet.js chain ID constant
const chainId = getChainId('starknet:mainnet');
console.log(chainId === constants.StarknetChainId.SN_MAIN); // true
```

## HTTP Headers (v2)

The x402 v2 protocol uses these HTTP headers:

| Header              | Description                               | Direction       |
| ------------------- | ----------------------------------------- | --------------- |
| `PAYMENT-REQUIRED`  | Base64-encoded `PaymentRequired` response | Server → Client |
| `PAYMENT-SIGNATURE` | Base64-encoded `PaymentPayload`           | Client → Server |
| `PAYMENT-RESPONSE`  | Base64-encoded settlement response        | Server → Client |

Example headers:

```http
# 402 Response
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3IiOiJQYXltZW50IHJlcXVpcmVkIi...

# Payment Request
POST /api/resource HTTP/1.1
PAYMENT-SIGNATURE: eyJ4NDAyVmVyc2lvbiI6Miwic2NoZW1lIjoiZXhhY3QiLCJuZXR3b3JrIjoi...

# Success Response
HTTP/1.1 200 OK
PAYMENT-RESPONSE: eyJzdWNjZXNzIjp0cnVlLCJ0cmFuc2FjdGlvbiI6IjB4MTIzNC...
```

## Comparison with Other Networks

### vs. EVM (EIP-3009)

| Feature          | Starknet              | EVM                          |
| ---------------- | --------------------- | ---------------------------- |
| Signature Format | `{r, s}` (two fields) | Single hex string            |
| Time Window      | `validUntil` (single) | `validAfter` + `validBefore` |
| Amount Field     | `amount`              | `value`                      |
| Token Field      | Explicit `token`      | Implied by contract          |
| Gas              | Paymaster sponsored   | Self-paid or meta-tx         |
| Verification     | Account contract call | ECDSA recovery               |
| Standard         | SNIP-6 + SNIP-12      | EIP-3009                     |

### vs. Solana (SVM)

| Feature                | Starknet             | Solana                       |
| ---------------------- | -------------------- | ---------------------------- |
| Transaction Format     | Typed data signature | Partially-signed transaction |
| Fee Payer              | Paymaster service    | Facilitator's account        |
| Account Model          | Account abstraction  | Program-derived addresses    |
| Signature Verification | Contract call        | Instruction validation       |
| Token Standard         | ERC20                | SPL Token                    |

## Appendix: Why Not EIP-3009?

Starknet does not support EIP-3009 because:

1. **Different VM**: Starknet uses Cairo VM, not EVM - EIP standards don't apply
2. **Native Account Abstraction**: All accounts are smart contracts with custom validation logic
3. **Different Signature Scheme**: Starknet uses STARK-friendly curves, not secp256k1
4. **No `msg.sender`**: Starknet has caller-dependent semantics but different execution model

Instead, Starknet achieves similar goals through:

- **SNIP-6**: Standard account interface including `isValidSignature`
- **SNIP-12**: Typed structured data hashing and signing
- **Paymaster Services**: Off-chain services that sponsor transaction gas

This approach provides equivalent functionality while being native to Starknet's architecture.

## References

- [SNIP-6: Standard Account Interface](https://github.com/starknet-io/SNIPs/blob/main/SNIPS/snip-6.md)
- [SNIP-12: Off-Chain Signatures for Typed Structured Data](https://github.com/starknet-io/SNIPs/blob/main/SNIPS/snip-12.md)
- [Starknet Documentation](https://docs.starknet.io/)
- [AVNU Paymaster Service](https://doc.avnu.fi/avnu-paymaster-service/introduction)
- [x402 Protocol Specification](https://github.com/coinbase/x402/blob/main/specs/x402-specification.md)
- [CAIP-2: Blockchain ID Specification](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md)
