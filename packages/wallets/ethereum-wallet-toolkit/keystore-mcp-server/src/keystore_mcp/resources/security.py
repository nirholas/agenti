"""
Keystore Security Guide Resource

Provides security best practices for keystore management.
"""

from mcp.server import Server


def register_security_resources(server: Server) -> None:
    """Register security resources with the MCP server."""
    
    @server.resource("keystore://security-guide")
    async def get_security_guide() -> str:
        """
        Security best practices for keystore management.
        """
        return SECURITY_GUIDE


SECURITY_GUIDE = """# Keystore Security Best Practices

## Overview

This guide covers security best practices for creating, storing, and
managing Ethereum keystores. Following these guidelines helps protect
your assets from theft and loss.

## Password Security

### Password Requirements

**Minimum Requirements:**
- At least 12 characters (16+ recommended)
- Mix of uppercase and lowercase letters
- Include numbers
- Include special characters
- NOT a dictionary word or common phrase

**Strong Password Examples:**
```
Good: Tr0ub4dor&3*Penguin!
Good: 7hK$mNp2@xQz9Lw#
Bad:  password123
Bad:  ethereum2024
```

### Password Management

1. **Never reuse passwords** across keystores
2. **Never share passwords** with anyone
3. **Don't store passwords digitally** on internet-connected devices
4. **Consider a password manager** for password generation
5. **Write down passwords** and store securely (separate from keystore)

## Keystore Storage

### Secure Storage Locations

**Recommended:**
- ✅ Hardware encrypted USB drives
- ✅ Air-gapped computers
- ✅ Safety deposit boxes
- ✅ Fireproof safes
- ✅ Encrypted cloud storage (with strong master password)

**Avoid:**
- ❌ Unencrypted cloud storage
- ❌ Email attachments
- ❌ Shared computers
- ❌ Mobile devices without encryption
- ❌ Public or shared folders

### Backup Strategy

**3-2-1 Backup Rule:**
- 3 copies of your keystore
- 2 different storage media types
- 1 copy in a different physical location

**Backup Checklist:**
- [ ] Primary keystore on encrypted drive
- [ ] Backup #1 on separate encrypted drive
- [ ] Backup #2 in different physical location
- [ ] Password stored separately from keystores
- [ ] Test restore from backup annually

## Air-Gapped Operations

### What is Air-Gapping?

An air-gapped computer is never connected to the internet, providing
maximum security for sensitive operations.

### Setting Up Air-Gapped Environment

1. **Dedicated Device**
   - Use a dedicated laptop or computer
   - Remove WiFi/Bluetooth hardware if possible
   - Never connect to any network

2. **Clean Operating System**
   - Fresh OS installation
   - Minimal software installed
   - Only trusted tools

3. **Data Transfer**
   - Use QR codes when possible
   - USB drives (scan for malware first)
   - One-way data flow preferred

### Air-Gapped Workflow

```
Online Computer              Air-Gapped Computer
      │                              │
      │ ──── Unsigned TX (QR) ────▶ │
      │                              │ Sign transaction
      │ ◀─── Signed TX (QR) ─────── │
      │                              │
      │ Broadcast TX                 │
```

## Common Attack Vectors

### Phishing

**How it works:**
- Fake websites mimicking legitimate services
- Emails requesting private key import
- Malicious browser extensions

**Protection:**
- Verify URLs carefully
- Never enter passwords on unfamiliar sites
- Use bookmarks for important sites
- Check SSL certificates

### Malware

**Types:**
- Keyloggers capture passwords
- Screen capture software
- Clipboard hijackers
- Fake wallet software

**Protection:**
- Keep software updated
- Use antivirus software
- Download only from official sources
- Verify checksums

### Social Engineering

**Tactics:**
- Impersonation of support staff
- Urgent requests for credentials
- Fake emergency scenarios

**Protection:**
- Never share passwords
- Verify identity through official channels
- Take time for important decisions
- Trust but verify

### Physical Theft

**Risks:**
- Stolen devices
- Stolen backups
- Shoulder surfing

**Protection:**
- Full disk encryption
- Strong device passwords
- Physical security
- Secure backup locations

## File Permissions

### Recommended Permissions

| Item | Unix Permissions | Description |
|------|-----------------|-------------|
| Keystore file | 0600 | Owner read/write only |
| Keystore directory | 0700 | Owner access only |
| Backup drives | Encrypted | Full disk encryption |

### Setting Permissions (Unix/Linux)

```bash
# Set file permissions
chmod 600 keystore.json

# Set directory permissions
chmod 700 keystores/

# Verify permissions
ls -la keystore.json
# Should show: -rw------- 1 user user ...
```

## Security Checklist

### Before Creating Keystore

- [ ] Using trusted, clean device
- [ ] No screen recording active
- [ ] Private location
- [ ] Strong password prepared
- [ ] Backup plan ready

### After Creating Keystore

- [ ] Password stored securely (separately)
- [ ] Keystore backed up (3-2-1 rule)
- [ ] Verified restore works
- [ ] File permissions set correctly
- [ ] Sensitive data cleared from clipboard

### Regular Maintenance

- [ ] Review backup integrity (quarterly)
- [ ] Test restore procedure (annually)
- [ ] Update weak passwords
- [ ] Audit access controls
- [ ] Check for software updates

## Emergency Procedures

### Suspected Compromise

1. **Immediate**: Move funds to new wallet
2. **Don't**: Try to investigate first
3. **Then**: Change all related passwords
4. **Document**: Note what happened
5. **Report**: If significant loss

### Lost Password

1. **Try variations**: Common typos, case changes
2. **Check backups**: Written passwords
3. **Brute force**: Only viable for weak passwords
4. **Accept loss**: If password truly lost

### Corrupted Keystore

1. **Try backups**: Restore from backup
2. **Partial recovery**: May be possible with intact crypto section
3. **Contact experts**: Professional recovery services exist

## Additional Resources

### Tools

- **Hardware Wallets**: Ledger, Trezor (for high-value storage)
- **Password Managers**: KeePass, 1Password (for password generation)
- **Encryption**: VeraCrypt (for encrypted containers)

### Further Reading

- Ethereum Security Best Practices
- BIP-39 Standard Specification
- Web3 Secret Storage Definition

---

⚠️ **Remember**: Security is a process, not a product. Regular review
and updating of your security practices is essential.
"""
