# Keystore Operations

> **DISCLAIMER: FOR EDUCATIONAL PURPOSES ONLY**
> 
> This software is provided for educational and research purposes only.
> DO NOT USE WITH REAL FUNDS. The author accepts NO LIABILITY for any damages.
> All example addresses and keys shown are FAKE - never use them for real funds.

This document covers the keystore encryption and decryption features of the Ethereum Wallet Toolkit.

## Overview

Keystores are encrypted JSON files that securely store private keys. They follow the [Web3 Secret Storage Definition](https://github.com/ethereum/wiki/wiki/Web3-Secret-Storage-Definition) (Version 3) and are compatible with all major Ethereum wallets including MetaMask, Geth, and MyEtherWallet.

## Security Model

### Key Derivation Functions

The toolkit supports two KDF algorithms:

| KDF | Security | Speed | Recommended |
|-----|----------|-------|-------------|
| scrypt | Higher | Slower | Yes (default) |
| pbkdf2 | Good | Faster | For compatibility |

**scrypt** (default):
- Memory-hard function resistant to ASIC attacks
- Parameters: N=262144, r=8, p=1
- More secure against brute-force attacks

**pbkdf2**:
- Uses HMAC-SHA256
- Default iterations: 262144
- Faster but less resistant to hardware attacks

### Encryption

- Cipher: AES-128-CTR
- Key derivation produces a 256-bit key
- First 128 bits used for encryption
- Last 128 bits used for MAC verification

## CLI Usage

### Using keystore.py (Standalone)

```bash
# Encrypt a private key
python keystore.py encrypt --key 0x... --password mypassword --output wallet.json

# Encrypt with secure password prompt
python keystore.py encrypt --key 0x... --output wallet.json

# Use PBKDF2 instead of scrypt
python keystore.py encrypt --key 0x... --password secret --kdf pbkdf2 --output wallet.json

# Decrypt a keystore
python keystore.py decrypt --file wallet.json --password mypassword

# Decrypt with password prompt (more secure)
python keystore.py decrypt --file wallet.json

# View keystore info without decryption
python keystore.py info --file wallet.json

# Change keystore password
python keystore.py change-password --file wallet.json
```

### Using eth_toolkit.py (Main Toolkit)

```bash
# Encrypt
python eth_toolkit.py keystore --encrypt --key 0x... --password secret --output wallet.json

# Decrypt
python eth_toolkit.py keystore --decrypt --file wallet.json --password secret
```

## Keystore File Format

```json
{
  "version": 3,
  "id": "uuid-here",
  "address": "abcdefghijkabcdefghijklmnopqrstuvwxyz",
  "crypto": {
    "ciphertext": "encrypted-private-key",
    "cipherparams": {
      "iv": "initialization-vector"
    },
    "cipher": "aes-128-ctr",
    "kdf": "scrypt",
    "kdfparams": {
      "dklen": 32,
      "salt": "random-salt",
      "n": 262144,
      "r": 8,
      "p": 1
    },
    "mac": "message-authentication-code"
  }
}
```

## Python API

```python
from keystore import (
    encrypt_keystore,
    decrypt_keystore,
    save_keystore,
    load_keystore,
    get_keystore_info
)

# Encrypt a private key
keystore = encrypt_keystore(
    private_key='0x...',
    password='my-secure-password',
    kdf='scrypt'
)

# Save to file
filepath = save_keystore(keystore, 'my-wallet.json')

# Load from file
keystore = load_keystore('my-wallet.json')

# Get info without decryption
info = get_keystore_info(keystore)
print(f"Address: {info['address']}")
print(f"KDF: {info['kdf']}")

# Decrypt
private_key = decrypt_keystore(keystore, 'my-secure-password')
```

## Best Practices

### Password Security

1. **Use strong passwords**: Minimum 12 characters with mixed case, numbers, symbols
2. **Never reuse passwords**: Each keystore should have a unique password
3. **Use a password manager**: Store passwords securely
4. **Avoid command-line passwords**: Use the prompt feature instead of `--password`

```bash
# Good - password prompted securely
python keystore.py encrypt --key 0x... --output wallet.json

# Avoid - password visible in shell history
python keystore.py encrypt --key 0x... --password secret --output wallet.json
```

### File Storage

1. **Backup keystores**: Keep multiple copies in secure locations
2. **Encrypt backups**: Use additional encryption for cloud storage
3. **Control access**: Restrict file permissions (chmod 600)
4. **Never share**: Keystore + password = full access to funds

### Testing

Always test decryption after creating a keystore:

```bash
# Create keystore
python keystore.py encrypt --key 0x... --output test.json

# Verify decryption works
python keystore.py decrypt --file test.json

# Check the derived address matches expected
python keystore.py info --file test.json
```

## Integration Examples

### MetaMask Import

MetaMask can import keystore files directly:
1. Open MetaMask
2. Click account icon > Import Account
3. Select "JSON File"
4. Upload your keystore file
5. Enter the password

### Geth Import

```bash
geth account import --datadir /path/to/data wallet.json
```

### Web3.py Integration

```python
from web3 import Web3

with open('wallet.json', 'r') as f:
    keystore = f.read()

private_key = Web3().eth.account.decrypt(keystore, 'password')
```

## Error Handling

### Common Errors

**Incorrect Password**
```
Error: Failed to decrypt keystore - MAC mismatch
Check that the password is correct.
```

**Corrupted File**
```
Error: Invalid keystore format
```

**Wrong KDF Parameters**
```
Error: Unsupported KDF algorithm
```

### Recovery

If you forget your password:
- There is **no recovery mechanism**
- Strong encryption means brute-force is impractical
- Always keep secure password backups

## Security Audit Checklist

- [ ] Using scrypt KDF (not pbkdf2)
- [ ] Password is 12+ characters
- [ ] Password is unique to this keystore
- [ ] Keystore is backed up in multiple locations
- [ ] Decryption tested after creation
- [ ] File permissions restricted
- [ ] Password stored in password manager
