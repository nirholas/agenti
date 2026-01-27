"""
Wallet Prompts for Ethereum Wallet MCP Server

This module implements MCP prompts (prompt templates) for guided wallet operations:
- Secure wallet creation guidance
- Wallet backup instructions
- Wallet recovery assistance

These prompts provide step-by-step guidance for common wallet operations
with embedded security best practices.
"""

from mcp.server import Server
from mcp.types import Prompt, PromptMessage, TextContent, PromptArgument


def register_wallet_prompts(server: Server) -> None:
    """
    Register all wallet-related prompts with the MCP server.
    
    Args:
        server: MCP Server instance to register prompts with
    """
    
    @server.prompt()
    async def create_secure_wallet(use_case: str = "personal") -> list[PromptMessage]:
        """
        A guided prompt for creating a new secure wallet with best practices.
        
        This prompt provides step-by-step guidance for creating a new Ethereum
        wallet tailored to the user's specific use case, including security
        recommendations and next steps.
        
        Args:
            use_case: The intended use for the wallet. Options:
                - "personal": General personal use
                - "business": Business/organizational use
                - "development": Development/testing
                - "cold_storage": Long-term secure storage
        
        Returns:
            List of prompt messages guiding the wallet creation process
        """
        use_case = use_case.lower().strip()
        
        # Customize recommendations based on use case
        recommendations = _get_use_case_recommendations(use_case)
        
        template = f"""# Secure Ethereum Wallet Creation Guide

## Your Use Case: {use_case.title()}

I'll help you create a secure Ethereum wallet optimized for {use_case} use.

---

## Step 1: Choose Your Wallet Type

{recommendations['wallet_type']}

**Recommendation for {use_case}:** {recommendations['recommended_type']}

---

## Step 2: Generate Your Wallet

{recommendations['generation_steps']}

---

## Step 3: Secure Your Recovery Phrase

{recommendations['backup_instructions']}

---

## Step 4: Verify Your Setup

{recommendations['verification_steps']}

---

## Security Checklist for {use_case.title()} Use

{recommendations['security_checklist']}

---

## Next Steps

{recommendations['next_steps']}

---

## ⚠️ Important Security Warnings

1. **Never share your private key or mnemonic phrase** with anyone
2. **Never store recovery phrases digitally** (no photos, no cloud storage)
3. **Verify addresses carefully** before any transaction
4. **Start with small amounts** to test your setup
5. **Keep software updated** for security patches

Would you like me to proceed with generating your wallet now?
"""
        
        return [
            PromptMessage(
                role="user",
                content=TextContent(
                    type="text",
                    text=template
                )
            )
        ]
    
    
    @server.prompt()
    async def backup_wallet_guide(backup_type: str = "mnemonic") -> list[PromptMessage]:
        """
        A guided prompt for properly backing up a wallet.
        
        Provides comprehensive step-by-step instructions for securely backing
        up an Ethereum wallet using various methods.
        
        Args:
            backup_type: Type of backup to create. Options:
                - "mnemonic": Backup using seed phrase
                - "keystore": Backup using encrypted keystore file
                - "paper": Physical paper wallet backup
        
        Returns:
            List of prompt messages with backup instructions
        """
        backup_type = backup_type.lower().strip()
        
        if backup_type == "mnemonic":
            template = """# Mnemonic Seed Phrase Backup Guide

## What is a Mnemonic?

A mnemonic (seed phrase) is a human-readable representation of your wallet's master key.
It's typically 12 or 24 words that can regenerate all your private keys.

---

## Materials Needed

- [ ] Pen (not pencil - it fades)
- [ ] Paper (acid-free archival paper recommended)
- [ ] Secure, private location
- [ ] Optional: Metal backup plate for fire/water resistance

---

## Step-by-Step Backup Process

### 1. Find a Private Location
- Ensure no one can see your screen
- Disable any screen recording software
- Close unnecessary applications

### 2. Generate or Display Your Mnemonic
Use the `generate_wallet_with_mnemonic` tool to create a new wallet, or
display your existing mnemonic from your wallet software.

### 3. Write Down Each Word
- Write clearly and legibly
- Number each word (1-12 or 1-24)
- Double-check spelling of each word
- Leave no ambiguity (e.g., distinguish "0" from "O")

### 4. Verify Your Backup
- Read back each word
- Compare against the original
- Test restoration in a safe environment if possible

### 5. Create Redundant Copies
- Make 2-3 copies minimum
- Store in different physical locations
- Consider geographic separation

---

## Storage Recommendations

### DO:
✅ Use a fireproof safe
✅ Consider bank safety deposit box
✅ Use metal backup for disaster resistance
✅ Split phrase using Shamir's Secret Sharing (advanced)

### DON'T:
❌ Take photos of your phrase
❌ Store in cloud services (iCloud, Google Drive, Dropbox)
❌ Email yourself the phrase
❌ Store in password managers
❌ Leave in obvious locations

---

## Security Considerations

1. **Physical Security**: Treat like cash or valuable jewelry
2. **Access Control**: Limit who knows about the backup
3. **Inheritance Planning**: Consider how heirs will access if needed
4. **Regular Verification**: Check backups annually

---

Would you like guidance on generating a new mnemonic now?
"""
        
        elif backup_type == "keystore":
            template = """# Keystore File Backup Guide

## What is a Keystore File?

A keystore file is an encrypted JSON file containing your private key.
It requires a password to decrypt and use.

---

## Keystore vs. Mnemonic

| Feature | Keystore | Mnemonic |
|---------|----------|----------|
| Format | Encrypted file | Plain text words |
| Password required | Yes | No (phrase IS the secret) |
| Single address | Yes | No (derives many addresses) |
| File management | Required | Not required |
| Industry standard | Ethereum-specific | Multi-chain (BIP39) |

---

## Creating a Keystore Backup

### Step 1: Generate or Export Keystore
Use the keystore tools to create an encrypted keystore file from your private key.

### Step 2: Choose a Strong Password
- Minimum 16 characters
- Mix of upper, lower, numbers, symbols
- Do NOT reuse passwords
- Store password separately from keystore file

### Step 3: Save the Keystore File
- Save to encrypted USB drive
- Make multiple copies on different media
- Label clearly (but not with amounts!)

### Step 4: Test Recovery
- On a separate device if possible
- Import keystore and verify address matches
- Clear test device afterward

---

## Storage Best Practices

### Recommended Storage Media:
- Encrypted USB drives (hardware encrypted preferred)
- Encrypted external hard drives
- Password-protected archives (7z with AES-256)

### Storage Locations:
- Home safe (fireproof)
- Bank safety deposit box
- Trusted family member's secure location

### Password Management:
- Store password in separate physical location
- Consider password manager for password only (not keystore)
- Document for inheritance planning

---

## Recovery Process

1. Locate keystore file and password
2. Import into wallet software
3. Enter password to decrypt
4. Verify address matches expected address
5. Ready to use

---

Would you like help creating a keystore file now?
"""
        
        elif backup_type == "paper":
            template = """# Paper Wallet Backup Guide

## What is a Paper Wallet?

A paper wallet is a physical document containing:
- Your public address (for receiving)
- Your private key (for spending)
- Optionally: QR codes for easy scanning

---

## ⚠️ Important Warnings About Paper Wallets

Paper wallets have significant drawbacks:

1. **Single Use Recommended**: Spending from paper wallet should move ALL funds
2. **Printer Security**: Printers can store data; use trusted/offline printer
3. **Physical Vulnerabilities**: Fire, water, fading, theft
4. **No Partial Spending**: Change address issues can cause fund loss

**Consider hardware wallets or mnemonic backups instead for most users.**

---

## If You Still Want a Paper Wallet

### Requirements:
- Air-gapped (offline) computer
- Trusted printer (or hand-write)
- High-quality paper (acid-free, archival)
- Waterproof pen or print
- Secure storage (safe, safety deposit box)

### Generation Process:

1. **Generate Wallet Offline**
   - Disconnect from internet
   - Use offline wallet generator
   - Generate address and private key

2. **Print or Write Carefully**
   - Include public address
   - Include private key (full hex string)
   - Optionally include QR codes
   - Double-check all characters

3. **Verify Before Funding**
   - On a SEPARATE device, import private key
   - Verify derived address matches printed address
   - Wipe the verification device

4. **Store Securely**
   - Laminate for water protection
   - Store in fireproof safe
   - Make redundant copies
   - Store copies in different locations

---

## Using Your Paper Wallet

### To Receive:
1. Share only the PUBLIC address
2. Never expose the private key
3. Verify address matches paper

### To Spend (ENTIRE BALANCE):
1. Import private key to software wallet
2. Send ALL funds to new secure address
3. The paper wallet is now COMPROMISED
4. Destroy the paper wallet

---

## Better Alternatives

Consider these more secure options:
- **Hardware Wallet**: Ledger, Trezor - keeps keys offline
- **Mnemonic Backup**: Metal plates, distributed storage
- **Multi-signature**: Requires multiple keys to spend

Would you like help with an alternative backup method?
"""
        
        else:
            template = f"""# Wallet Backup Guide

Unknown backup type: "{backup_type}"

## Available Backup Methods

1. **mnemonic** - Seed phrase backup (most common, recommended)
2. **keystore** - Encrypted keystore file backup
3. **paper** - Physical paper wallet

Please specify one of these backup types to get detailed instructions.

Example: "Help me backup my wallet using mnemonic"
"""
        
        return [
            PromptMessage(
                role="user",
                content=TextContent(
                    type="text",
                    text=template
                )
            )
        ]
    
    
    @server.prompt()
    async def recover_wallet_help(recovery_method: str = "mnemonic") -> list[PromptMessage]:
        """
        A guided prompt for wallet recovery assistance.
        
        Provides step-by-step guidance for recovering access to an Ethereum
        wallet using various recovery methods.
        
        Args:
            recovery_method: Method to use for recovery. Options:
                - "mnemonic": Recover from seed phrase
                - "private_key": Recover from private key
                - "keystore": Recover from keystore file
        
        Returns:
            List of prompt messages with recovery instructions
        """
        recovery_method = recovery_method.lower().strip()
        
        if recovery_method == "mnemonic":
            template = """# Wallet Recovery from Mnemonic Seed Phrase

## Before You Begin

### Security Checklist:
- [ ] You are in a private, secure location
- [ ] No one can see your screen
- [ ] Screen recording/sharing is disabled
- [ ] You trust this device
- [ ] You have your complete seed phrase ready

---

## Step-by-Step Recovery

### Step 1: Verify Your Mnemonic

Check that your mnemonic:
- Has 12, 15, 18, 21, or 24 words
- All words are from the BIP39 word list
- Words are in the correct order
- No spelling errors

### Step 2: Determine Your Derivation Path

Common Ethereum derivation paths:
- **Standard (MetaMask, etc.)**: `m/44'/60'/0'/0/0`
- **Ledger Live**: `m/44'/60'/0'/0/0`
- **Legacy Ledger**: `m/44'/60'/0'/0`
- **MEW/MyCrypto**: `m/44'/60'/0'/0/0`

If unsure, try the standard path first.

### Step 3: Remember Your Passphrase (if used)

Did you use a 25th word (passphrase)?
- If yes, you'll need it for recovery
- If no passphrase was used, leave it blank
- Wrong passphrase = different (empty) wallet

### Step 4: Recover Your Wallet

Use the `restore_wallet_from_mnemonic` tool with:
- Your mnemonic phrase
- Passphrase (if used)
- Derivation path

### Step 5: Verify Recovery

After recovery, verify:
- The address matches your expected address
- Check a blockchain explorer for your transaction history
- If wrong, try different derivation paths

---

## Troubleshooting

### Wrong Address Derived?

1. **Check derivation path**: Try common alternatives
2. **Check passphrase**: Was one used? Correct spelling?
3. **Check word order**: Even one swap changes everything
4. **Check word spelling**: Similar words exist (e.g., "abandon" vs "about")

### Can't Validate Mnemonic?

1. **Check word count**: Must be 12, 15, 18, 21, or 24
2. **Check each word**: All must be valid BIP39 words
3. **Check for extra spaces**: Words should be single-space separated

### Still Having Issues?

- Try deriving multiple account indices (0, 1, 2...)
- Check if wallet used non-standard path
- Verify mnemonic source/backup

---

## Security Reminders

⚠️ After recovery:
1. **Verify the address** before receiving funds
2. **Consider creating new wallet** if security compromised
3. **Update your backup** if anything changed
4. **Clear any clipboard data** containing sensitive info

Would you like to proceed with recovery? I can use the `restore_wallet_from_mnemonic` tool to help.
"""
        
        elif recovery_method == "private_key":
            template = """# Wallet Recovery from Private Key

## Before You Begin

### Security Checklist:
- [ ] Private location, no observers
- [ ] Screen sharing/recording disabled
- [ ] Trusted device
- [ ] Private key ready (with or without 0x prefix)

---

## Understanding Private Keys

A valid Ethereum private key is:
- 64 hexadecimal characters (0-9, a-f)
- Optionally prefixed with "0x"
- Total: 64 chars without prefix, 66 chars with prefix

Example format:
```
Without prefix: 4c0883a69102937d6231471b5dbb6204fe512961708279f2e3e8a5d4b8e3c1a2
With prefix: 0x4c0883a69102937d6231471b5dbb6204fe512961708279f2e3e8a5d4b8e3c1a2
```

---

## Step-by-Step Recovery

### Step 1: Prepare Your Private Key

- Locate your private key backup
- Verify it's 64 hex characters (not counting 0x prefix)
- Check for any transcription errors

### Step 2: Recover Your Wallet

Use the `restore_wallet_from_private_key` tool with your private key.

The tool accepts both formats:
- With 0x prefix: `0x4c0883a...`
- Without prefix: `4c0883a...`

### Step 3: Verify Recovery

After recovery, verify:
- Address matches your expected address
- Check blockchain explorer for transaction history
- Confirm you can see your expected balance

---

## Troubleshooting

### Invalid Key Error?

1. **Check length**: Must be exactly 64 hex characters
2. **Check characters**: Only 0-9 and a-f allowed
3. **Check for spaces**: Remove any whitespace
4. **Check for typos**: Common confusions: 0/O, 1/l/I

### Wrong Address?

If the address doesn't match what you expected:
- Private key may be corrupted
- You may have the wrong key
- Original wallet may have used different method

### Key Looks Correct But Won't Import?

- Remove any quotes or extra formatting
- Try both with and without 0x prefix
- Ensure no hidden characters (copy to plain text editor)

---

## Security After Recovery

⚠️ **Critical Security Steps:**

1. **If key was exposed**: Transfer funds to new wallet immediately
2. **If key backup is damaged**: Create new secure backup
3. **Consider upgrading**: Use mnemonic-based wallet for future
4. **Clear sensitive data**: Remove key from clipboard, close documents

---

## Limitations of Private Key Recovery

Unlike mnemonic recovery:
- Recovers only ONE address
- Cannot derive additional accounts
- No easy backup/restore process
- Consider migrating to mnemonic-based wallet

Would you like to proceed with private key recovery?
"""
        
        elif recovery_method == "keystore":
            template = """# Wallet Recovery from Keystore File

## What You'll Need

1. **Keystore file** (JSON format, starts with `{"version":3,...}`)
2. **Password** used to encrypt the keystore

---

## Understanding Keystore Files

A keystore file:
- Is a JSON file with encrypted private key
- Requires the original password to decrypt
- Contains your address (can verify before decrypting)
- Uses strong encryption (scrypt/pbkdf2)

---

## Step-by-Step Recovery

### Step 1: Locate Your Keystore File

Common locations:
- Personal backup drives
- `~/.ethereum/keystore/` (geth)
- MetaMask export location
- Your documented backup location

File naming: Usually `UTC--<timestamp>--<address>`

### Step 2: Verify the File

Open in text editor and check:
- Valid JSON format
- Contains "address" field
- Contains "crypto" section
- Version is typically 3

### Step 3: Remember Your Password

The keystore password:
- Was set when keystore was created
- Is NOT your wallet passphrase (if using mnemonic)
- Cannot be recovered if forgotten
- Is case-sensitive

### Step 4: Decrypt and Recover

Use the keystore decryption tools to:
1. Load the keystore file
2. Enter your password
3. Extract the private key
4. Derive the address

### Step 5: Verify Recovery

After decryption:
- Verify address matches file's address field
- Check blockchain for expected balance/history
- Test with small transaction if needed

---

## Troubleshooting

### Wrong Password Error?

- Passwords are case-sensitive
- Check for leading/trailing spaces  
- Try variations you might have used
- No password recovery possible - it's cryptographic

### File Won't Parse?

- Ensure complete file (no truncation)
- Check valid JSON syntax
- Remove any added formatting
- Verify file isn't corrupted

### Address Mismatch?

- File may be for different wallet
- Password correct but wrong keystore
- Check your backup documentation

---

## Security Considerations

### After Recovery:

1. **Consider creating new wallet**: If keystore was compromised
2. **Update backups**: Ensure you have current, secure backups
3. **Store password securely**: Separate from keystore file
4. **Document location**: Update your backup records

### Keystore Security:

- Encrypted with your password
- Stronger password = stronger protection
- AES-128-CTR encryption
- Scrypt key derivation (slow, prevents brute force)

---

## Migrating from Keystore

Consider upgrading to:
- **Mnemonic-based wallet**: More flexible, standard
- **Hardware wallet**: Most secure for significant funds

Steps:
1. Recover via keystore
2. Create new mnemonic wallet
3. Transfer all funds
4. Securely destroy old keystore

Would you like to proceed with keystore recovery?
"""
        
        else:
            template = f"""# Wallet Recovery Help

Unknown recovery method: "{recovery_method}"

## Available Recovery Methods

1. **mnemonic** - Recover from 12/24 word seed phrase (most common)
2. **private_key** - Recover from hex private key
3. **keystore** - Recover from encrypted keystore file

Please specify one of these recovery methods to get detailed instructions.

Example: "Help me recover my wallet using mnemonic"
"""
        
        return [
            PromptMessage(
                role="user",
                content=TextContent(
                    type="text",
                    text=template
                )
            )
        ]


def _get_use_case_recommendations(use_case: str) -> dict:
    """
    Get customized recommendations based on use case.
    
    Args:
        use_case: The wallet use case
        
    Returns:
        Dictionary of recommendations for the use case
    """
    recommendations = {
        "personal": {
            "wallet_type": """
For personal use, you have several options:

1. **Software Wallet with Mnemonic** (Recommended for beginners)
   - Easy to use
   - Can recover from seed phrase
   - Good for moderate amounts

2. **Hardware Wallet** (Best for larger amounts)
   - Ledger, Trezor, etc.
   - Private keys never leave device
   - Most secure option
""",
            "recommended_type": "24-word mnemonic wallet for better security",
            "generation_steps": """
I recommend generating a wallet with a 24-word mnemonic for maximum security:

```
generate_wallet_with_mnemonic(word_count=24)
```

This provides 256 bits of entropy, making it extremely secure against brute-force attacks.
""",
            "backup_instructions": """
**For Personal Use Backup:**

1. Write down your 24 words on paper
2. Store in a home safe or secure location
3. Consider a fireproof backup (metal plate)
4. Make one redundant copy in different location
5. Tell a trusted family member where backup is stored
""",
            "verification_steps": """
1. Re-enter your mnemonic to verify it's correct
2. Check the derived address matches
3. Send a small test amount
4. Verify receipt on blockchain explorer
5. Try restoring on a different device (optional but recommended)
""",
            "security_checklist": """
- [ ] Using strong, unique password for any wallet app
- [ ] Two-factor authentication enabled where available
- [ ] Recovery phrase stored securely (not digitally)
- [ ] Wallet software from official sources only
- [ ] Regular security updates applied
- [ ] Phishing awareness (verify URLs carefully)
""",
            "next_steps": """
1. Fund your wallet with a small test amount
2. Practice sending a transaction
3. Verify backup by restoring on another device
4. Consider hardware wallet for larger amounts
5. Learn about gas fees and transaction confirmation
"""
        },
        "business": {
            "wallet_type": """
For business use, consider:

1. **Multi-signature Wallet** (Recommended)
   - Requires multiple approvals
   - Reduces single-point-of-failure
   - Gnosis Safe, etc.

2. **Hardware Wallet + MPC**
   - Institutional-grade security
   - Distributed key management
   - Fireblocks, Copper, etc.

3. **Custodial Solution**
   - Professional custody services
   - Insurance available
   - Regulatory compliance
""",
            "recommended_type": "Multi-signature wallet with 2-of-3 or 3-of-5 scheme",
            "generation_steps": """
For business, I recommend a multi-signature approach:

1. Generate 3-5 separate wallets using `generate_wallet_with_mnemonic(word_count=24)`
2. Use these as signers for a multi-sig contract
3. Define approval threshold (e.g., 2-of-3 required)

Each signer wallet should be:
- Generated on separate, secure devices
- Managed by different authorized personnel
- Backed up according to strict procedures
""",
            "backup_instructions": """
**Business Backup Protocol:**

1. Each signer's mnemonic backed up separately
2. Use professional-grade metal backups
3. Store in separate physical locations (e.g., bank vaults)
4. Implement key ceremony with witnesses
5. Document all backup procedures
6. Regular audits of backup accessibility
7. Consider Shamir's Secret Sharing for additional security
""",
            "verification_steps": """
1. Verify each signer wallet independently
2. Test multi-sig transaction with small amount
3. Verify all signers can approve
4. Test recovery procedures with each signer
5. Document verification results
6. Have security audit performed
""",
            "security_checklist": """
- [ ] Separation of duties for signers
- [ ] Background checks on key holders
- [ ] Formal key management policy
- [ ] Regular security training
- [ ] Incident response plan
- [ ] Insurance coverage
- [ ] Regulatory compliance verified
- [ ] Third-party security audit
- [ ] Access logging and monitoring
- [ ] Regular procedure drills
""",
            "next_steps": """
1. Draft and approve key management policy
2. Conduct key generation ceremony
3. Set up multi-signature contract
4. Test all operational procedures
5. Engage security auditor
6. Obtain appropriate insurance
7. Train all key holders
8. Schedule regular security reviews
"""
        },
        "development": {
            "wallet_type": """
For development/testing:

1. **Burner Wallets** (Recommended for testing)
   - Quick to generate
   - No real value needed
   - Easy to dispose

2. **Deterministic Test Wallets**
   - Same addresses across tests
   - Use known test mnemonics
   - Never use for real funds
""",
            "recommended_type": "Standard 12-word mnemonic (sufficient for development)",
            "generation_steps": """
For development, generate a simple test wallet:

```
generate_wallet_with_mnemonic(word_count=12)
```

Or use the well-known test mnemonic (NEVER FOR REAL FUNDS):
```
"test test test test test test test test test test test junk"
```

Derive multiple test accounts:
```
derive_multiple_accounts(mnemonic="...", count=10)
```
""",
            "backup_instructions": """
**Development Wallet Backup (Simple):**

For development wallets:
1. Save mnemonic in development environment file
2. Keep in `.env` file (git-ignored)
3. Document test addresses in README
4. No secure backup needed for test wallets

⚠️ NEVER use development wallets for real funds!
""",
            "verification_steps": """
1. Verify wallet generates expected test address
2. Fund with testnet tokens (Goerli, Sepolia, etc.)
3. Test basic transactions
4. Verify gas estimation works
5. Test error handling with invalid transactions
""",
            "security_checklist": """
- [ ] Test wallets clearly labeled as TEST ONLY
- [ ] No real funds ever sent to test addresses
- [ ] Mnemonics not committed to git
- [ ] Separate wallets for each environment
- [ ] CI/CD uses dedicated test accounts
- [ ] Production keys never in development
""",
            "next_steps": """
1. Set up local development environment
2. Configure testnet (Goerli, Sepolia)
3. Get testnet ETH from faucets
4. Implement and test wallet functions
5. Write comprehensive tests
6. Set up CI/CD with test accounts
"""
        },
        "cold_storage": {
            "wallet_type": """
For cold storage (long-term, high-value):

1. **Hardware Wallet** (Strongly Recommended)
   - Ledger Nano X/S Plus
   - Trezor Model T/One
   - Private keys never exposed

2. **Air-gapped Computer**
   - Dedicated offline device
   - Never connected to internet
   - Sign transactions offline

3. **Metal Seed Backup**
   - Fire/flood resistant
   - Stamped or engraved metal
   - Multiple locations
""",
            "recommended_type": "Hardware wallet with 24-word mnemonic on metal backup",
            "generation_steps": """
For cold storage, I recommend:

1. **Use a hardware wallet** (Ledger/Trezor) to generate keys
2. If using software, generate on air-gapped computer:

```
generate_wallet_with_mnemonic(word_count=24)
```

Important:
- Generate on never-connected device
- Verify on second air-gapped device
- Never type mnemonic into connected computer
""",
            "backup_instructions": """
**Cold Storage Backup Protocol:**

1. **Metal Backup** (Primary)
   - Use steel or titanium plates
   - Stamp or engrave each word
   - Test plate for readability
   - Store in fireproof safe

2. **Geographic Distribution**
   - Minimum 2 locations
   - Different geographic areas
   - Consider safe deposit box

3. **Additional Measures**
   - Take photos? NO!
   - Cloud backup? NO!
   - Consider Shamir splitting for very large amounts
""",
            "verification_steps": """
1. Verify mnemonic readable on metal backup
2. Test restore on separate air-gapped device
3. Verify address derivation matches
4. Send small test amount
5. Verify on blockchain explorer
6. Test again after initial funding settles
""",
            "security_checklist": """
- [ ] Generated on air-gapped device
- [ ] Verified on second air-gapped device
- [ ] Metal backup created and verified
- [ ] Backup stored in fireproof location
- [ ] Second backup in geographically separate location
- [ ] No digital copies of mnemonic exist
- [ ] Inheritance plan documented
- [ ] Test restoration performed
- [ ] Address verified on multiple explorers
""",
            "next_steps": """
1. Acquire hardware wallet from official source
2. Set up in secure, private environment
3. Generate and verify mnemonic
4. Create metal backup
5. Store backup securely
6. Fund with small test amount
7. Document address for inheritance
8. Set calendar reminder for annual verification
"""
        }
    }
    
    # Return recommendations for the specified use case, or personal as default
    return recommendations.get(use_case, recommendations["personal"])
