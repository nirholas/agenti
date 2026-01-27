"""
Keystore Examples Resource

Provides example keystores for testing and reference.
"""

from mcp.server import Server


def register_example_resources(server: Server) -> None:
    """Register example resources with the MCP server."""
    
    @server.resource("keystore://examples/{example_type}")
    async def get_keystore_examples(example_type: str) -> str:
        """
        Example keystores for testing and reference.
        
        Types: scrypt, pbkdf2, legacy, invalid
        """
        example_type = example_type.lower()
        
        if example_type == "scrypt":
            return SCRYPT_EXAMPLE
        elif example_type == "pbkdf2":
            return PBKDF2_EXAMPLE
        elif example_type == "legacy":
            return LEGACY_EXAMPLES
        elif example_type == "invalid":
            return INVALID_EXAMPLES
        else:
            return f"""# Unknown Example Type: {example_type}

Available example types:
- **scrypt**: Standard scrypt-encrypted keystore
- **pbkdf2**: PBKDF2-encrypted keystore
- **legacy**: Legacy V1/V2 format examples (historical reference)
- **invalid**: Examples of invalid keystores for testing

Usage: keystore://examples/scrypt
"""


SCRYPT_EXAMPLE = """# Scrypt Keystore Example

## Standard Scrypt Keystore (V3)

This is a valid Web3 Secret Storage V3 keystore encrypted with scrypt.

**⚠️ WARNING: This is a TEST keystore. Never use for real funds!**

### Keystore JSON

```json
{
  "version": 3,
  "id": "a9b5e2f4-3c1d-4e8f-9a2b-c5d6e7f8a9b0",
  "address": "0x742d35cc6634c0532925a3b844bc9e7595f8fe00",
  "crypto": {
    "ciphertext": "5318b4d5bcd28de64ee5559e671353e16f075ecae9f99c7a79a38af5f869aa46",
    "cipherparams": {
      "iv": "6087dab2f9fdbbfaddc31a909735c1e6"
    },
    "cipher": "aes-128-ctr",
    "kdf": "scrypt",
    "kdfparams": {
      "n": 262144,
      "r": 8,
      "p": 1,
      "dklen": 32,
      "salt": "ab0c7876052600dd703518d6fc3fe8984592145b591fc8fb5c6d43190334ba19"
    },
    "mac": "517ead924a9d0dc3124507e3393d175ce3ff7c1e96529c6c555ce9e51205e9b2"
  }
}
```

### Test Credentials

- **Password**: `testpassword123`
- **Private Key**: `0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318`
- **Address**: `0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00`

### Parameter Analysis

| Parameter | Value | Assessment |
|-----------|-------|------------|
| KDF | scrypt | ✅ Recommended |
| N | 262144 | ✅ Standard security |
| r | 8 | ✅ Standard |
| p | 1 | ✅ Standard |
| Cipher | aes-128-ctr | ✅ Standard |
| dklen | 32 | ✅ Correct |

### Usage Notes

This keystore can be used for:
- Testing decryption functionality
- Verifying cross-platform compatibility
- Learning keystore structure
- Development and testing

**DO NOT** use this keystore or credentials for:
- Real funds
- Production systems
- Any actual Ethereum transactions
"""


PBKDF2_EXAMPLE = """# PBKDF2 Keystore Example

## Standard PBKDF2 Keystore (V3)

This is a valid Web3 Secret Storage V3 keystore encrypted with PBKDF2.

**⚠️ WARNING: This is a TEST keystore. Never use for real funds!**

### Keystore JSON

```json
{
  "version": 3,
  "id": "b8c6d3e5-4f2a-5b9c-0d3e-f6a7b8c9d0e1",
  "address": "008aeeda4d805471df9b2a5b0f38a0c3bcba786b",
  "crypto": {
    "ciphertext": "d172bf743a674da9cdad04534d56926ef8358534d458fffccd4e6ad2fbde479c",
    "cipherparams": {
      "iv": "83dbcc02d8ccb40e466191a123791e0e"
    },
    "cipher": "aes-128-ctr",
    "kdf": "pbkdf2",
    "kdfparams": {
      "c": 262144,
      "dklen": 32,
      "prf": "hmac-sha256",
      "salt": "ae3cd4e7013836a3df6bd7241b12db061dbe2c6785853cce422d148a624ce0bd"
    },
    "mac": "517ead924a9d0dc3124507e3393d175ce3ff7c1e96529c6c555ce9e51205e9b2"
  }
}
```

### Test Credentials

- **Password**: `testpassword`
- **Address**: `0x008AeEda4D805471dF9b2A5B0f38A0C3bCBA786b`

### Parameter Analysis

| Parameter | Value | Assessment |
|-----------|-------|------------|
| KDF | pbkdf2 | ⚠️ Consider scrypt |
| c (iterations) | 262144 | ✅ Standard |
| prf | hmac-sha256 | ✅ Correct |
| Cipher | aes-128-ctr | ✅ Standard |
| dklen | 32 | ✅ Correct |

### When to Use PBKDF2

PBKDF2 is appropriate when:
- Mobile or embedded devices
- Quick unlock required
- Memory constraints exist

Consider upgrading to scrypt for:
- Desktop applications
- High-value storage
- Long-term security
"""


LEGACY_EXAMPLES = """# Legacy Keystore Examples

## Historical Reference Only

These examples show older keystore formats that are no longer recommended
but may be encountered in legacy systems.

**⚠️ Do not create new keystores in these formats!**

---

## Version 1 (Pre-Standard)

Version 1 keystores used a simpler, less secure format.

```json
{
  "Address": "d4584b5f6229b7be90727b0fc8c6b91bb427821f",
  "Crypto": {
    "CipherText": "07533e172414bfa50e99dba4a0ce603f...",
    "IV": "16d67ba0ce5a339ff2f07951253e6ba8",
    "KeyHeader": {
      "Version": "1",
      "Kdf": "scrypt"
    },
    "MAC": "8ccded24da2e99a11d48cda146f9cc8213eb423e2ea0d8427f41c3be7fb24...",
    "Salt": "06870e5e6a24e183a5c807d1c2c4..."
  },
  "Id": "0498f19a-59db-4d54-ac95-33901b4f1870",
  "Version": "1"
}
```

### Issues with V1

- Non-standard field naming (capitalized)
- Missing some security parameters
- Limited tool support

---

## Version 2 (Transitional)

Version 2 was a brief transitional format.

```json
{
  "version": 2,
  "id": "...",
  "address": "...",
  "Crypto": {
    // Similar to V3 but with some differences
  }
}
```

### Migration from V2 to V3

To migrate:
1. Decrypt with original password
2. Re-encrypt with V3 format
3. Verify address matches
4. Securely delete old keystore

---

## Upgrading Legacy Keystores

### Step-by-Step Migration

1. **Backup Original**
   - Keep the original keystore safe
   - Document the password

2. **Decrypt**
   - Use compatible tool for the version
   - Extract private key

3. **Re-encrypt to V3**
   - Use `encrypt_keystore` tool
   - Use scrypt KDF
   - Use strong password

4. **Verify**
   - Decrypt new keystore
   - Verify addresses match
   - Test with small transaction

5. **Clean Up**
   - Securely delete old keystore
   - Update backups
"""


INVALID_EXAMPLES = """# Invalid Keystore Examples

## Testing Error Handling

These examples show various invalid keystores for testing validation
and error handling.

---

## Missing Version

```json
{
  "id": "a9b5e2f4-3c1d-4e8f-9a2b-c5d6e7f8a9b0",
  "address": "742d35cc6634c0532925a3b844bc9e7595f8fe00",
  "crypto": {
    "ciphertext": "...",
    "cipher": "aes-128-ctr",
    "kdf": "scrypt",
    "kdfparams": {...},
    "mac": "..."
  }
}
```

**Error**: Missing 'version' field

---

## Wrong Version

```json
{
  "version": 2,
  "id": "...",
  "address": "...",
  "crypto": {...}
}
```

**Error**: Unsupported version (expected 3)

---

## Missing Crypto Section

```json
{
  "version": 3,
  "id": "a9b5e2f4-3c1d-4e8f-9a2b-c5d6e7f8a9b0",
  "address": "742d35cc6634c0532925a3b844bc9e7595f8fe00"
}
```

**Error**: Missing 'crypto' section

---

## Invalid KDF

```json
{
  "version": 3,
  "id": "...",
  "address": "...",
  "crypto": {
    "ciphertext": "...",
    "cipherparams": {"iv": "..."},
    "cipher": "aes-128-ctr",
    "kdf": "bcrypt",
    "kdfparams": {...},
    "mac": "..."
  }
}
```

**Error**: Unsupported KDF 'bcrypt'

---

## Missing KDF Parameters

```json
{
  "version": 3,
  "id": "...",
  "address": "...",
  "crypto": {
    "ciphertext": "...",
    "cipherparams": {"iv": "..."},
    "cipher": "aes-128-ctr",
    "kdf": "scrypt",
    "kdfparams": {
      "n": 262144
      // Missing r, p, dklen, salt
    },
    "mac": "..."
  }
}
```

**Error**: Missing scrypt params: ['r', 'p', 'dklen', 'salt']

---

## Invalid MAC Length

```json
{
  "version": 3,
  "crypto": {
    "mac": "abcd1234"  // Too short, should be 64 hex chars
  }
}
```

**Error**: Invalid MAC length (expected 64 hex chars)

---

## Invalid IV Length

```json
{
  "version": 3,
  "crypto": {
    "cipherparams": {
      "iv": "1234"  // Too short, should be 32 hex chars
    }
  }
}
```

**Error**: Invalid IV length (expected 32 hex chars)

---

## Invalid Address

```json
{
  "version": 3,
  "id": "...",
  "address": "not-a-valid-address",
  "crypto": {...}
}
```

**Error**: Invalid address format

---

## Using Invalid Examples

These examples can be used to test:
- Validation logic
- Error messages
- Edge case handling
- Security checks

Always ensure your code properly rejects invalid keystores!
"""
