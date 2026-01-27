"""
Keystore Migration Prompts

Provides guided prompts for keystore migration scenarios.
"""

from mcp.server import Server


def register_migration_prompts(server: Server) -> None:
    """Register migration prompts with the MCP server."""
    
    @server.prompt("keystore_migration")
    async def keystore_migration() -> str:
        """
        Guide for migrating keystores between formats and parameters.
        """
        return KEYSTORE_MIGRATION_PROMPT
    
    @server.prompt("wallet_software_migration")
    async def wallet_software_migration() -> str:
        """
        Guide for migrating between different wallet software.
        """
        return WALLET_SOFTWARE_MIGRATION_PROMPT


KEYSTORE_MIGRATION_PROMPT = """# Keystore Migration Guide

I'll help you migrate your keystores to improved formats or parameters.

## Common Migration Scenarios

### 1. PBKDF2 to Scrypt

Upgrade from PBKDF2 to scrypt for better security against hardware attacks.

**When to migrate:**
- Moving from mobile to desktop
- Increasing security requirements
- Long-term storage

**Process:**
```
Step 1: Check current parameters
Use: get_keystore_info

Step 2: Decrypt with current password
Use: decrypt_keystore
- keystore: Your current keystore
- password: Current password

Step 3: Re-encrypt with scrypt
Use: encrypt_keystore
- private_key: Decrypted key
- password: Strong new password
- kdf: scrypt
```

### 2. Increase KDF Strength

Upgrade N parameter for scrypt or iterations for PBKDF2.

**When to migrate:**
- Hardware has improved
- Higher value stored
- Regulatory requirements

**Recommended new parameters:**

| KDF | Parameter | Light | Standard | Maximum |
|-----|-----------|-------|----------|---------|
| scrypt | N | 2^16 | 2^18 | 2^20 |
| pbkdf2 | c | 100K | 262K | 1M |

**Process:**
```
Use: change_keystore_password
- keystore: Current keystore
- old_password: Current password
- new_password: New strong password
- new_kdf: scrypt
- n: 1048576 (for 2^20)
```

### 3. Password Update

Change password while maintaining same address.

**When to change:**
- Password may be compromised
- Regular rotation policy
- Simplifying/strengthening password

**Process:**
```
Use: change_keystore_password
- keystore: Current keystore
- old_password: Current password
- new_password: New strong password
```

### 4. Legacy Format Upgrade

Migrate from V1 or V2 to V3 format.

**When to migrate:**
- Have old geth/parity keystores
- Tool compatibility issues
- Security audit requirements

**Process:**
```
Step 1: Identify format
Use: validate_keystore
- Will show version and any issues

Step 2: Extract and re-encrypt
Use: decrypt_keystore (may need legacy tool)
Use: encrypt_keystore with V3 parameters
```

## Batch Migration

For multiple keystores:

```
Use: batch_encrypt_keystores
- private_keys: List of keys
- password: Strong password
- kdf: scrypt
```

## Migration Checklist

Before migration:
- [ ] Current keystore backed up
- [ ] Password recorded securely
- [ ] Clean, secure environment

During migration:
- [ ] Decryption succeeds
- [ ] New password is strong
- [ ] Correct KDF selected

After migration:
- [ ] New keystore created
- [ ] Address verified (matches original)
- [ ] Backup updated
- [ ] Old keystore securely deleted (optional)

## Security Considerations

⚠️ **Important**:
- Never lose access during migration
- Keep old keystore until verified
- Use secure environment
- Clear sensitive data after

## Need Help?

Tell me which migration you need:
1. Upgrade to scrypt
2. Increase security parameters
3. Change password
4. Upgrade legacy format
5. Batch migration
"""


WALLET_SOFTWARE_MIGRATION_PROMPT = """# Wallet Software Migration Guide

I'll help you migrate keystores between different wallet applications.

## Supported Migrations

### From MetaMask

MetaMask doesn't export V3 keystores directly. Options:

1. **Export Private Key**
   - Settings → Security → Export Private Key
   - Then create keystore:
   ```
   Use: encrypt_keystore
   - private_key: Exported key
   - password: Strong password
   ```

2. **Export Seed Phrase**
   - Use HD wallet derivation tools
   - Derive same accounts from seed

### From MyEtherWallet (MEW)

MEW exports standard V3 keystores:

1. **Download Keystore**
   - Access wallet → Download Keystore File
   - File is already in V3 format

2. **Verify Compatibility**
   ```
   Use: validate_keystore
   - keystore: Downloaded file
   ```

### From Geth

Geth keystores are V3 compliant:

1. **Locate Keystores**
   - Linux: `~/.ethereum/keystore/`
   - Mac: `~/Library/Ethereum/keystore/`
   - Windows: `%APPDATA%\\Ethereum\\keystore\\`

2. **Copy Files**
   - Files are standard JSON
   - Ready to use in any V3-compatible tool

### From Parity/OpenEthereum

Standard V3 format:

1. **Locate Keystores**
   - Linux: `~/.local/share/openethereum/keys/`
   - Mac: `~/Library/Application Support/OpenEthereum/keys/`

2. **Export**
   - Files are standard V3 JSON

### To Hardware Wallet

Moving to Ledger/Trezor:

1. **Decrypt Keystore**
   ```
   Use: decrypt_keystore
   - keystore: Your keystore
   - password: Your password
   ```

2. **Import to Hardware Wallet**
   - Follow hardware wallet import instructions
   - Some support direct private key import
   - Others require seed phrase (different process)

3. **Transfer Funds**
   - Better to transfer funds to hardware wallet address
   - Don't reuse software wallet keys on hardware

### To Software Wallet

Importing to various software:

**MetaMask:**
- Settings → Import Account → Private Key
- Use decrypted private key

**MyEtherWallet:**
- Access via Keystore File
- Upload V3 keystore directly

**Trust Wallet:**
- Settings → Wallets → Import
- Use private key or keystore

## Format Compatibility Matrix

| Software | V3 Keystore | Private Key | Mnemonic |
|----------|-------------|-------------|----------|
| Geth | ✅ Native | ✅ Import | ❌ |
| MetaMask | ❌ | ✅ Import | ✅ Native |
| MEW | ✅ Native | ✅ Import | ✅ Import |
| Trust Wallet | ✅ Import | ✅ Import | ✅ Native |
| Ledger | ❌ | ⚠️ Some | ✅ Recovery |

## Security During Migration

### Before Migration

- [ ] Backup existing wallet
- [ ] Verify backup works
- [ ] Use secure computer
- [ ] Private environment

### During Migration

- [ ] Clear clipboard after paste
- [ ] Don't save keys in temporary files
- [ ] Verify addresses match

### After Migration

- [ ] Test with small transaction
- [ ] Update backup documentation
- [ ] Securely delete temporary data

## Common Issues

### "Invalid keystore format"
- Check if file is JSON
- Verify version is 3
- Use validate_keystore to diagnose

### "Incorrect password"
- Check for typos
- Try variations
- Verify correct keystore file

### "Address mismatch"
- Verify using same account
- Check HD derivation path
- May be different account

## Need Help?

Tell me your migration path:
1. From: _______ (e.g., MetaMask)
2. To: _______ (e.g., V3 Keystore)

I'll provide specific instructions for your case.
"""
