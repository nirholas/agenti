"""
Keystore Backup Prompts

Provides guided prompts for secure wallet backup procedures.
"""

from mcp.server import Server


def register_backup_prompts(server: Server) -> None:
    """Register backup prompts with the MCP server."""
    
    @server.prompt("secure_wallet_backup")
    async def secure_wallet_backup() -> str:
        """
        Step-by-step guide for creating secure keystore backups.
        """
        return SECURE_WALLET_BACKUP_PROMPT
    
    @server.prompt("verify_backup_integrity")
    async def verify_backup_integrity() -> str:
        """
        Guide for verifying backup integrity and accessibility.
        """
        return VERIFY_BACKUP_INTEGRITY_PROMPT


SECURE_WALLET_BACKUP_PROMPT = """# Secure Wallet Backup Guide

I'll help you create secure backups of your Ethereum keystores following
industry best practices.

## Pre-Backup Checklist

Before we begin, please confirm:
1. You're on a trusted, private computer
2. No screen sharing or recording is active
3. You have secure storage media ready (encrypted USB, etc.)
4. You have a secure location for password storage

## Backup Process

### Step 1: Prepare Secure Storage

**Option A: Encrypted USB Drive**
- Use a new or securely wiped USB drive
- Enable hardware encryption if available
- Or use software encryption (VeraCrypt)

**Option B: Encrypted Cloud Backup**
- Use a trusted encrypted cloud service
- Enable 2FA on the account
- Never store password in same location

### Step 2: Export Your Keystore

Your keystore file contains your encrypted private key. To create it:

1. **If you have a private key:**
   ```
   Use: encrypt_keystore
   - private_key: Your private key
   - password: Strong password (16+ chars)
   - kdf: scrypt (recommended)
   ```

2. **If you have an existing keystore:**
   ```
   Use: save_keystore_file
   - keystore: Your keystore JSON
   - output_dir: Your backup location
   ```

### Step 3: Create Multiple Copies

Follow the 3-2-1 backup rule:
- **3** total copies of the keystore
- **2** different storage types
- **1** copy offsite

Recommended distribution:
1. Primary encrypted USB (at home)
2. Secondary encrypted USB (bank safe deposit)
3. Encrypted cloud backup

### Step 4: Secure the Password

**Critical**: Store the password SEPARATELY from the keystore!

Options:
- Written on paper in a fireproof safe
- In a password manager (different from keystore storage)
- Split across multiple secure locations

### Step 5: Verify Backups

After creating backups:

1. **Test decryption** from each backup
   ```
   Use: decrypt_keystore
   - keystore: Load from backup
   - password: Your password
   ```

2. **Verify address matches** expected address

3. **Document** backup locations (securely)

## Security Reminders

⚠️ **Never**:
- Store password with keystore
- Send keystore via email
- Store on shared computers
- Use weak passwords
- Forget to verify backups

✅ **Always**:
- Use strong, unique passwords
- Encrypt backup storage
- Test restore procedure
- Keep offsite backup
- Update backups after changes

## Next Steps

Would you like me to help you:
1. Create a new encrypted keystore
2. Verify an existing backup
3. Migrate to a stronger KDF
4. Check your keystore's security settings
"""


VERIFY_BACKUP_INTEGRITY_PROMPT = """# Verify Backup Integrity

I'll help you verify that your keystore backups are intact and accessible.

## Why Verify Backups?

- Storage media can fail silently
- Files can become corrupted
- Passwords can be forgotten
- Regular testing prevents disasters

## Verification Checklist

### Step 1: Locate All Backups

List all your backup locations:
- [ ] Primary backup location: _______________
- [ ] Secondary backup location: _______________
- [ ] Offsite backup location: _______________

### Step 2: Physical Media Check

For each physical backup (USB, HDD):
- [ ] Device powers on
- [ ] Device is recognized by computer
- [ ] Files are visible
- [ ] No read errors

### Step 3: File Integrity

For each keystore file:

1. **Check file exists and has content**
   - File size should be 1-2 KB typically
   - File should open as valid JSON

2. **Validate keystore structure**
   ```
   Use: validate_keystore
   - keystore: Load the backup file
   ```

3. **Verify expected address**
   ```
   Use: get_keystore_info
   - keystore: Load the backup file
   ```
   Compare address to your records.

### Step 4: Decryption Test

**Most Important Step!**

For each backup, verify you can decrypt:

```
Use: decrypt_keystore
- keystore: Load from backup
- password: Your stored password
```

Success criteria:
- [ ] Decryption completes without error
- [ ] Private key is returned
- [ ] Derived address matches expected

### Step 5: Document Results

Record verification date and results:

| Backup Location | Date Verified | Status | Notes |
|-----------------|---------------|--------|-------|
| Primary USB | | | |
| Safety Deposit | | | |
| Cloud Backup | | | |

## If Verification Fails

### File Not Found
- Check if moved or renamed
- Restore from another backup
- Create new backup immediately

### Corruption Detected
- Try alternate backups
- Professional recovery may be possible
- Create new backup from working copy

### Password Forgotten
- Check all password storage locations
- Try common variations
- Consider password recovery tools (slow)

### Wrong Address
- Verify using correct keystore
- Check for multiple accounts
- May indicate wrong backup

## Recommended Schedule

| Action | Frequency |
|--------|-----------|
| Quick file check | Monthly |
| Decryption test | Quarterly |
| Full verification | Annually |
| After any changes | Immediately |

## Need Help?

Would you like me to:
1. Validate a specific keystore file
2. Help identify issues with a backup
3. Create a new verified backup
4. Set up a better backup system
"""
