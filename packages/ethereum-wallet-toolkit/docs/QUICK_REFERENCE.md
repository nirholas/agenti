# Quick Reference Card

Fast lookup for common operations across all MCP servers.

## Wallet Generation (ethereum-wallet-mcp)

| Want to... | Prompt |
|------------|--------|
| New random wallet | `Generate a new Ethereum wallet` |
| Wallet with seed phrase | `Generate wallet with 12/24 word mnemonic` |
| Restore from mnemonic | `Restore wallet from seed: [words]` |
| Restore from key | `Import private key: 0x...` |
| HD wallet accounts | `Derive 5 accounts from mnemonic` |
| Vanity address | `Generate address starting with "cafe"` |

## Signing (signing-mcp-server)

| Want to... | Prompt |
|------------|--------|
| Sign message | `Sign "Hello" with key 0x...` |
| Verify signature | `Verify signature 0x... for message "Hello" from 0x...` |
| Recover signer | `Who signed "Hello" with signature 0x...?` |
| Sign EIP-712 | `Sign typed data: [domain] [message] with key 0x...` |
| Hash typed data | `Compute EIP-712 hash without signing` |
| Split signature | `Decompose signature 0x... into v,r,s` |

## Transactions (transaction-mcp-server)

| Want to... | Prompt |
|------------|--------|
| Build transfer | `Build ETH transfer: 1 ETH to 0x..., chain 1, nonce 0` |
| Sign transaction | `Sign transaction with key 0x...` |
| Decode raw tx | `Decode transaction 0x02f8...` |
| Encode calldata | `Encode transfer(0x..., 1000000)` |
| Decode calldata | `Decode calldata 0xa9059cbb...` |
| Estimate cost | `Estimate cost: 21000 gas at 30 gwei` |

## Keystore (keystore-mcp-server)

| Want to... | Prompt |
|------------|--------|
| Encrypt key | `Create keystore from 0x... with password "..."` |
| Decrypt keystore | `Decrypt keystore [JSON] with password "..."` |
| Get address only | `What address is in this keystore?` |
| Change password | `Change keystore password from "old" to "new"` |
| Validate keystore | `Is this keystore valid? [JSON]` |

## Validation (validation-mcp-server)

| Want to... | Prompt |
|------------|--------|
| Validate address | `Is 0x... a valid address?` |
| Checksum address | `Convert 0x... to checksum format` |
| Validate key | `Is 0x... a valid private key?` |
| Derive address | `Address for private key 0x...?` |
| Hash data | `Keccak256 of "Hello"` |
| Function selector | `Selector for transfer(address,uint256)` |
| Decode selector | `What function is 0xa9059cbb?` |
| Storage slot | `Storage slot for mapping at 0 with key 0x...` |

---

## Common Parameter Formats

### Private Keys
```
0x + 64 hex characters (32 bytes)
Example: 0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318
```

### Addresses
```
0x + 40 hex characters (20 bytes)
Example: 0x2c7536E3605D9C16a7a3D7b1898e529396a65c23
```

### Signatures
```
0x + 130 hex characters (65 bytes)
Contains r (32 bytes) + s (32 bytes) + v (1 byte)
```

### Mnemonics
```
12 or 24 words from BIP39 wordlist
Example: abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
```

### Chain IDs
```
1 = Ethereum Mainnet
11155111 = Sepolia Testnet
137 = Polygon
42161 = Arbitrum One
10 = Optimism
8453 = Base
```

### Gas Units
```
1 ETH = 1,000,000,000 Gwei = 1,000,000,000,000,000,000 Wei
1 Gwei = 1,000,000,000 Wei
```

---

## Error Responses

All tools return errors in this format:
```json
{
  "error": true,
  "message": "Description of what went wrong"
}
```

Check `result.get('error')` before using response data.

---

## Security Quick Tips

✅ **DO:**
- Use test keys for experimentation
- Verify addresses before sending funds
- Keep mnemonics offline
- Use encrypted keystores

❌ **DON'T:**
- Share private keys
- Use known test keys for real funds
- Skip signature verification
- Store unencrypted keys
