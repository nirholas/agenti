# Message Signing

> **DISCLAIMER: FOR EDUCATIONAL PURPOSES ONLY**
> 
> This software is provided for educational and research purposes only.
> DO NOT USE WITH REAL FUNDS. The author accepts NO LIABILITY for any damages.
> All example addresses and keys shown are FAKE - never use them for real funds.

This document covers the message signing and verification features of the Ethereum Wallet Toolkit.

## Overview

The signing module implements [EIP-191](https://eips.ethereum.org/EIPS/eip-191) (personal_sign), the standard for signing arbitrary messages in Ethereum. This is commonly used for:

- **Wallet authentication**: "Sign in with Ethereum"
- **Off-chain verification**: Prove wallet ownership
- **Message attestation**: Cryptographic proof of statements

## How It Works

### Message Prefix

Before signing, EIP-191 prepends a prefix:
```
"\x19Ethereum Signed Message:\n" + len(message) + message
```

This prevents signed messages from being used as valid transactions.

### Signature Format

The signature consists of:
- **r** (32 bytes): Part of the signature
- **s** (32 bytes): Part of the signature
- **v** (1 byte): Recovery ID (27 or 28, or 0/1)

Total: 65 bytes (130 hex characters)

## CLI Usage

### Sign Messages

```bash
# Basic signing
python sign.py sign --message "Hello, Ethereum!" --key 0x...

# Show signature components
python sign.py sign --message "Hello" --key 0x... --verbose
```

Output:
```
MESSAGE SIGNED
==============
Message:   Hello, Ethereum!
Signer:    0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
Signature: 0xabc...

Signature Components:
  v: 28
  r: 0xabc...
  s: 0xdef...
  Message Hash: 0x123...
```

### Verify Signatures

```bash
# Verify a signature
python sign.py verify \
  --message "Hello, Ethereum!" \
  --signature 0xabc... \
  --address 0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
```

Output:
```
SIGNATURE VERIFICATION
======================
Message:           Hello, Ethereum!
Expected Address:  0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
Recovered Address: 0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
Valid:             Yes
```

### Recover Signer

```bash
# Recover signer without knowing the address
python sign.py recover --message "Hello" --signature 0xabc...
```

Output:
```
SIGNER RECOVERED
================
Message:   Hello
Signature: 0xabc...
Signer:    0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
```

## Python API

```python
from sign import (
    sign_message,
    verify_message,
    recover_signer
)

# Sign a message
result = sign_message("Hello, Ethereum!", "0xPrivateKey...")
print(f"Signature: {result['signature']}")
print(f"Signer: {result['address']}")

# Verify a signature
verification = verify_message(
    message="Hello, Ethereum!",
    signature="0x...",
    address="0xExpectedAddress..."
)
print(f"Valid: {verification['is_valid']}")

# Recover signer
signer = recover_signer("Hello, Ethereum!", "0xSignature...")
print(f"Signer: {signer}")
```

## Use Cases

### 1. Sign in with Ethereum (SIWE)

Authenticate users without passwords:

```bash
# Server generates challenge
CHALLENGE="Sign in to MyApp\nNonce: abc123\nTimestamp: 2024-01-01T00:00:00Z"

# User signs challenge
python sign.py sign --message "$CHALLENGE" --key 0x...

# Server verifies signature and address
python sign.py verify --message "$CHALLENGE" --signature 0x... --address 0x...
```

### 2. Prove Wallet Ownership

```bash
# User signs a specific message
python sign.py sign --message "I own this wallet" --key 0x...

# Anyone can verify without the private key
python sign.py verify \
  --message "I own this wallet" \
  --signature 0x... \
  --address 0xClaimedAddress
```

### 3. Off-Chain Agreements

```bash
# Alice signs an agreement
python sign.py sign --message "I agree to terms v1.0" --key 0xAlice

# Store the signature as proof
# Later, verify Alice's agreement
python sign.py verify --message "I agree to terms v1.0" --signature 0x... --address 0xAlice
```

## Signature Components

### Understanding v, r, s

```python
result = sign_message("Hello", "0x...")
print(f"v: {result['v']}")   # 27 or 28 (recovery ID)
print(f"r: {result['r']}")   # First 32 bytes
print(f"s: {result['s']}")   # Second 32 bytes
```

### Compact vs Full Signature

**Full (65 bytes)**: `r (32) + s (32) + v (1)`
**Compact (64 bytes)**: `r (32) + yParityAndS (32)`

Most Ethereum tools use the 65-byte format.

## Integration Examples

### Web3.js

```javascript
// Sign
const signature = await web3.eth.personal.sign(message, address, password);

// Verify
const signer = await web3.eth.personal.ecRecover(message, signature);
```

### Ethers.js

```javascript
// Sign
const signature = await signer.signMessage(message);

// Verify
const signer = ethers.verifyMessage(message, signature);
```

### Smart Contract Verification

```solidity
function verify(
    string memory message,
    bytes memory signature,
    address expectedSigner
) public pure returns (bool) {
    bytes32 messageHash = keccak256(abi.encodePacked(
        "\x19Ethereum Signed Message:\n",
        Strings.toString(bytes(message).length),
        message
    ));
    
    return ECDSA.recover(messageHash, signature) == expectedSigner;
}
```

## Security Considerations

### Message Content

1. **Include context**: Add app name, timestamp, nonce
2. **Prevent replay**: Use unique identifiers
3. **Be specific**: Clear language about what is being signed

Bad:
```
"Sign this"
```

Good:
```
"MyApp Authentication Request
Nonce: 7f8k2j
Timestamp: 2024-01-15T10:30:00Z
Action: Login to MyApp
Address: 0x..."
```

### Signature Verification

1. **Always verify**: Never trust user-provided addresses
2. **Check message**: Ensure message matches expected
3. **Prevent replay**: Store used nonces

### Common Attacks

**Replay Attack**
- Same signature used multiple times
- Mitigation: Include unique nonce

**Signature Malleability**
- Signatures can be modified to remain valid
- Mitigation: Use EIP-2 compliant signatures (s in lower half)

**Phishing**
- Malicious sites request signatures
- Mitigation: Clear message content, user education

## EIP-191 vs EIP-712

| Feature | EIP-191 | EIP-712 |
|---------|---------|---------|
| Message Type | Plain text | Structured data |
| Human Readable | Limited | Yes (typed) |
| Domain Separation | No | Yes |
| Use Case | Simple auth | DeFi, complex data |

Use EIP-191 for simple messages, EIP-712 for structured data.

## Troubleshooting

### Invalid Signature

1. Check message is exactly the same (whitespace matters)
2. Verify signature format (with 0x prefix)
3. Ensure correct address comparison (case-insensitive)

### Recovery Fails

1. Signature may be corrupted
2. Message doesn't match original
3. Invalid v value (should be 27-28 or 0-1)

### Different Addresses

Same message + same key = same signature (deterministic)

If addresses differ:
1. Message text doesn't match exactly
2. Wrong private key was used
3. Signature was modified
