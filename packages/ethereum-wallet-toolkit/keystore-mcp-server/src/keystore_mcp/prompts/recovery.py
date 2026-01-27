"""
Keystore Recovery and Security Audit Prompts

Provides guided prompts for recovery procedures and security audits.
"""

from mcp.server import Server


def register_recovery_prompts(server: Server) -> None:
    """Register recovery and security prompts with the MCP server."""
    
    @server.prompt("keystore_recovery")
    async def keystore_recovery() -> str:
        """
        Guide for recovering access to keystores.
        """
        return KEYSTORE_RECOVERY_PROMPT
    
    @server.prompt("security_audit")
    async def security_audit() -> str:
        """
        Comprehensive security audit for keystore setup.
        """
        return SECURITY_AUDIT_PROMPT


KEYSTORE_RECOVERY_PROMPT = """# Keystore Recovery Guide

I'll help you recover access to your Ethereum keystores.

## Identify Your Situation

### Situation 1: Forgotten Password

**Difficulty: Very High**

If you've forgotten your keystore password:

1. **Try variations**
   - Common typos
   - Different capitalization
   - Similar characters (0/O, 1/l)
   - Old password patterns

2. **Check password storage**
   - Password managers
   - Written notes
   - Encrypted files
   - Browser saved passwords

3. **Password recovery tools**
   - Only works for weak passwords
   - Can take extremely long time
   - May require significant resources

**Reality check:** Strong passwords (16+ chars, random) are practically
uncrackable. Prepare for potential loss if password truly unknown.

### Situation 2: Corrupted Keystore File

**Difficulty: Medium**

If your keystore file is corrupted:

1. **Check backups**
   ```
   Look in all backup locations
   Try each copy
   ```

2. **Partial recovery**
   - If JSON structure intact, may recover
   - Need ciphertext, IV, salt, MAC

3. **File recovery tools**
   - May recover deleted files
   - Check recycle bin
   - Professional recovery services

### Situation 3: Lost Keystore File

**Difficulty: Medium (with backup), High (without)**

1. **Check all storage**
   - Primary computer
   - Backup drives
   - Cloud storage
   - Old devices

2. **Search for file patterns**
   - Filename: `UTC--*` or `*.json`
   - Look in Ethereum data directories

3. **If you have private key**
   ```
   Use: encrypt_keystore
   - private_key: Your key
   - password: New strong password
   ```

4. **If you have seed phrase**
   - Use HD wallet tools
   - Derive same account

### Situation 4: Wrong Password Error

**Difficulty: Low to Medium**

1. **Verify correct file**
   ```
   Use: get_keystore_info
   - Check address matches expected
   ```

2. **Check password encoding**
   - UTF-8 issues
   - Copy/paste problems
   - Whitespace at beginning/end

3. **Try original device**
   - Keyboard layout differences
   - Input method issues

## Recovery Procedures

### Procedure A: Password Variation Testing

```python
# Common variations to try:
# 1. Different case: Password123 vs password123 vs PASSWORD123
# 2. Common substitutions: passw0rd vs password
# 3. Prefix/suffix: !password vs password!
# 4. Keyboard adjacents: qassword (q next to p)
```

### Procedure B: Backup File Search

Search locations:
- `~/.ethereum/keystore/` (Linux)
- `~/Library/Ethereum/keystore/` (Mac)
- `%APPDATA%\\Ethereum\\keystore\\` (Windows)
- USB drives
- Cloud storage (Dropbox, Drive, etc.)
- Email attachments (old)

### Procedure C: Professional Recovery

For high-value recovery:
1. Document everything you know
2. Gather all partial information
3. Contact professional services
4. Be wary of scams

## Prevention for Future

After recovery, ensure:

1. **Proper backup system**
   - 3-2-1 backup rule
   - Test restore regularly

2. **Password management**
   - Use password manager
   - Written backup in secure location

3. **Documentation**
   - Record what exists where
   - Keep recovery procedures

## What I Can Help With

1. **Validate keystore** - Check if file is valid
2. **Get keystore info** - Verify address
3. **Test decryption** - With known password
4. **Create new backup** - After recovery

What situation best describes your case?
"""


SECURITY_AUDIT_PROMPT = """# Keystore Security Audit

I'll help you perform a comprehensive security audit of your keystore setup.

## Audit Scope

This audit covers:
- ✅ Keystore file security
- ✅ Password strength
- ✅ KDF parameters
- ✅ Backup procedures
- ✅ Storage security
- ✅ Access controls

## Part 1: Keystore Analysis

### 1.1 File Validation

First, let's validate your keystore:

```
Use: validate_keystore
- keystore: Your keystore JSON
```

Check results for:
- [ ] Version is 3
- [ ] All required fields present
- [ ] No validation errors

### 1.2 Security Parameters

Analyze encryption parameters:

```
Use: get_keystore_info
- keystore: Your keystore JSON
```

**Scoring:**

| Parameter | Weak | Standard | Strong |
|-----------|------|----------|--------|
| KDF | pbkdf2 | scrypt | scrypt |
| Scrypt N | <2^16 | 2^18 | ≥2^20 |
| PBKDF2 c | <100K | 262K | ≥500K |
| Cipher | - | aes-128-ctr | aes-128-ctr |

Your rating: _______

### 1.3 Recommendations

Based on parameters:
- **Weak**: Immediate upgrade recommended
- **Standard**: Acceptable, consider upgrade
- **Strong**: Excellent configuration

## Part 2: Password Assessment

### 2.1 Password Strength Checklist

Evaluate your password:
- [ ] 12+ characters (16+ preferred)
- [ ] Mixed case letters
- [ ] Numbers included
- [ ] Special characters
- [ ] Not a dictionary word
- [ ] Not reused from other accounts
- [ ] Not based on personal info

**Score:** __/7

### 2.2 Password Storage

Where is your password stored?
- [ ] Memory only (risky)
- [ ] Written in secure location (good)
- [ ] Password manager (good)
- [ ] Digital file (risky if unencrypted)
- [ ] Multiple secure locations (best)

## Part 3: Backup Assessment

### 3.1 Backup Inventory

List your backups:

| Location | Type | Encrypted | Last Verified |
|----------|------|-----------|---------------|
| | | | |
| | | | |
| | | | |

### 3.2 3-2-1 Rule Compliance

- [ ] 3+ total copies
- [ ] 2+ different media types
- [ ] 1+ offsite location

**Compliant:** Yes / No

### 3.3 Backup Testing

- [ ] Tested restore in last year
- [ ] Verified decryption works
- [ ] Confirmed address matches

## Part 4: Storage Security

### 4.1 Primary Storage

- [ ] Full disk encryption enabled
- [ ] Strong device password
- [ ] Automatic lock enabled
- [ ] Antivirus/antimalware active
- [ ] OS up to date

### 4.2 File Permissions

Check permissions (Unix/Linux):
```bash
ls -la /path/to/keystore.json
# Should show: -rw------- (600)
```

- [ ] Owner-only read/write
- [ ] Not world-readable

### 4.3 Backup Storage

For each backup:
- [ ] Encrypted storage
- [ ] Physical security (locked)
- [ ] Access logging (if digital)

## Part 5: Operational Security

### 5.1 Access Procedures

- [ ] Private environment for operations
- [ ] Screen privacy ensured
- [ ] Clipboard cleared after use
- [ ] No screen recording during use

### 5.2 Network Security

- [ ] Air-gapped option available
- [ ] VPN for sensitive operations
- [ ] Trusted network only

## Audit Summary

### Overall Score

| Category | Score | Max | Status |
|----------|-------|-----|--------|
| Keystore Config | /10 | 10 | |
| Password | /10 | 10 | |
| Backup | /10 | 10 | |
| Storage | /10 | 10 | |
| Operations | /10 | 10 | |
| **Total** | **/50** | 50 | |

### Rating

| Score | Rating | Action |
|-------|--------|--------|
| 45-50 | Excellent | Maintain practices |
| 35-44 | Good | Minor improvements |
| 25-34 | Fair | Review weak areas |
| <25 | Poor | Immediate action needed |

## Remediation Actions

### High Priority
1. 
2. 
3. 

### Medium Priority
1. 
2. 
3. 

### Low Priority
1. 
2. 
3. 

## Next Steps

Would you like me to help you:
1. Analyze a specific keystore
2. Upgrade KDF parameters
3. Create better backups
4. Improve password security
5. Set up better storage
"""
