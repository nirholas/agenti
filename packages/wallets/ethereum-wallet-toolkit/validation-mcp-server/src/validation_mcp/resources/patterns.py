"""
Address Patterns Resource

Provides known address patterns and special addresses.
"""

from mcp.server.fastmcp import FastMCP


ADDRESS_PATTERNS = """
# Known Ethereum Address Patterns

## Special Addresses

### Zero Address
```
0x0000000000000000000000000000000000000000
```
- Used to represent "no address" or "burn address"
- Sending to this address burns tokens permanently
- Contract creation transactions have `to: null` (not zero address)

### Dead Address
```
0x000000000000000000000000000000000000dEaD
```
- Common burn address with checksummed "dEaD"
- Often used for token burns to avoid zero address issues

### EIP-1820 Registry
```
0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24
```
- Universal registry for interface detection
- Same address on all EVM chains

## Precompiled Contracts (0x01 - 0x09)

| Address | Name | Description |
|---------|------|-------------|
| 0x01 | ecRecover | Recover signer from signature |
| 0x02 | SHA256 | SHA-256 hash |
| 0x03 | RIPEMD160 | RIPEMD-160 hash |
| 0x04 | Identity | Data copy (memcpy) |
| 0x05 | ModExp | Modular exponentiation |
| 0x06 | ecAdd | Elliptic curve addition |
| 0x07 | ecMul | Elliptic curve multiplication |
| 0x08 | ecPairing | Elliptic curve pairing |
| 0x09 | Blake2F | Blake2 compression |

## CREATE2 Factory Addresses

### Deterministic Deployment Proxy
```
0x4e59b44847b379578588920cA78FbF26c0B4956C
```
- Nick's method deterministic deployer
- Same address on all chains

### CREATE2 Factory (Arachnid)
```
0x0000000000FFe8B47B3e2130213B802212439497
```
- Alternative CREATE2 factory

## Common Protocol Addresses

### Uniswap V2 Router
```
0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
```

### Uniswap V3 Router
```
0xE592427A0AEce92De3Edee1F18E0157C05861564
```

### WETH (Mainnet)
```
0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
```

## Vanity Patterns

Common vanity prefixes used by protocols:
- `0xdead...` - Burn addresses
- `0x0000...` - Leading zeros (gas efficient)
- `0xaaaa...` - Aesthetic patterns
- `0x1234...` - Sequential patterns

## Address Generation Patterns

### CREATE Address
```
address = keccak256(RLP([sender, nonce]))[12:]
```

### CREATE2 Address
```
address = keccak256(0xff ++ sender ++ salt ++ keccak256(bytecode))[12:]
```

## Security Notes

1. Always verify addresses match expected checksums
2. Zero address transfers usually indicate burns
3. Precompile addresses (0x01-0x09) have special behavior
4. Same address on different chains may be different contracts
5. Vanity addresses don't indicate legitimacy
"""


WEAK_KEYS_INFO = """
# Known Weak Private Keys

## WARNING
These keys are publicly known and should NEVER be used for real funds.
Anyone with these keys can steal any assets sent to them.

## Categories of Weak Keys

### Sequential Keys (Brain Wallet Attacks)
```
0x0000000000000000000000000000000000000000000000000000000000000001
0x0000000000000000000000000000000000000000000000000000000000000002
0x0000000000000000000000000000000000000000000000000000000000000003
```
These are the first few valid private keys and are constantly monitored.

### Common Brain Wallet Phrases
Private keys derived from common phrases:
- "password" → 0x...
- "test" → 0x...
- "" (empty string) → 0x...

### Repeated Patterns
```
0x1111111111111111111111111111111111111111111111111111111111111111
0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff (invalid - exceeds curve order)
```

## Historical Incidents

### Blockchain Bandit
An attacker systematically drained wallets with weak keys:
- Over 700+ weak keys compromised
- Millions in ETH stolen
- Keys included sequential numbers and common phrases

### Brain Wallet Attacks
Brain wallets (deriving keys from memorable phrases) are extremely vulnerable:
- Attackers precompute millions of phrase → key mappings
- Any funds sent are stolen within seconds
- Even "creative" phrases are vulnerable

## Protection Measures

1. **Use cryptographically secure randomness**
   - Hardware random number generators
   - Well-audited libraries (eth-account, etc.)

2. **Never derive keys from**
   - Words or phrases
   - Sequential numbers
   - Predictable patterns
   - User input

3. **Use HD wallets with proper entropy**
   - BIP-39 with 128+ bits of entropy
   - Hardware wallet generation

4. **Validate generated keys**
   - Check entropy estimation
   - Verify not in known weak key lists
   - Use proper libraries that reject weak keys
"""


def register_patterns_resources(server: FastMCP) -> None:
    """Register address patterns and weak keys resources."""
    
    @server.resource("validation://address-patterns")
    async def get_address_patterns() -> str:
        """
        Known Ethereum address patterns.
        
        Includes special addresses (zero, dead), precompiles,
        protocol addresses, and common patterns.
        """
        return ADDRESS_PATTERNS
    
    @server.resource("validation://known-weak-keys")
    async def get_weak_keys_info() -> str:
        """
        Information about known weak private keys.
        
        Covers brain wallet vulnerabilities, sequential keys,
        historical incidents, and protection measures.
        """
        return WEAK_KEYS_INFO
