# API Reference

> **DISCLAIMER: FOR EDUCATIONAL PURPOSES ONLY**
> 
> This software is provided for educational and research purposes only.
> DO NOT USE WITH REAL FUNDS. The author accepts NO LIABILITY for any damages.
> All example addresses and keys shown are FAKE - never use them for real funds.

Complete API documentation for the Ethereum Wallet Toolkit.

## Table of Contents

- [Data Classes](#data-classes)
- [Wallet Generation](#wallet-generation)
- [Wallet Restoration](#wallet-restoration)
- [Vanity Address Generation](#vanity-address-generation)
- [Message Signing](#message-signing)
- [Validation Functions](#validation-functions)
- [Utility Functions](#utility-functions)

---

## Data Classes

### WalletResult

Result object returned from wallet generation functions.

```python
@dataclass
class WalletResult:
    address: str              # Ethereum address (0x-prefixed, 42 chars)
    private_key: str          # Private key in hex format
    mnemonic: Optional[str]   # BIP39 mnemonic phrase (if generated)
    derivation_path: Optional[str]  # HD wallet derivation path
```

### VanityResult

Extended result object for vanity address generation.

```python
@dataclass
class VanityResult(WalletResult):
    attempts: int = 0         # Number of addresses generated before match
    time_seconds: float = 0.0 # Time taken to find the address
```

---

## Wallet Generation

### create_wallet()

Generate a new random Ethereum wallet.

```python
def create_wallet() -> WalletResult
```

**Returns:** `WalletResult` with address and private key.

**Example:**
```python
from eth_toolkit import create_wallet

wallet = create_wallet()
print(f"Address: {wallet.address}")
print(f"Private Key: {wallet.private_key}")
```

---

### create_wallet_with_mnemonic()

Generate a new wallet with a BIP39 mnemonic phrase.

```python
def create_wallet_with_mnemonic(
    num_words: int = 12,
    language: str = "english",
    passphrase: str = "",
    derivation_path: str = ETHEREUM_DEFAULT_PATH
) -> WalletResult
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `num_words` | int | 12 | Number of words (12, 15, 18, 21, or 24) |
| `language` | str | "english" | Wordlist language |
| `passphrase` | str | "" | Optional BIP39 passphrase |
| `derivation_path` | str | "m/44'/60'/0'/0/0" | HD derivation path |

**Returns:** `WalletResult` with address, private key, mnemonic, and derivation path.

**Supported Languages:**
- english, spanish, french, italian, japanese, korean
- chinese_simplified, chinese_traditional, czech

**Example:**
```python
from eth_toolkit import create_wallet_with_mnemonic

# 24-word mnemonic with passphrase
wallet = create_wallet_with_mnemonic(
    num_words=24,
    passphrase="my-secret-passphrase"
)
print(f"Mnemonic: {wallet.mnemonic}")
print(f"Address: {wallet.address}")
```

---

## Wallet Restoration

### restore_from_mnemonic()

Restore a wallet from an existing BIP39 mnemonic.

```python
def restore_from_mnemonic(
    mnemonic: str,
    passphrase: str = "",
    derivation_path: str = ETHEREUM_DEFAULT_PATH
) -> WalletResult
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `mnemonic` | str | required | BIP39 mnemonic phrase |
| `passphrase` | str | "" | BIP39 passphrase (if used during creation) |
| `derivation_path` | str | "m/44'/60'/0'/0/0" | HD derivation path |

**Example:**
```python
from eth_toolkit import restore_from_mnemonic

# FAKE EXAMPLE - DO NOT USE FOR REAL FUNDS
# Use your own securely generated mnemonic
wallet = restore_from_mnemonic(
    mnemonic="word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12",
    derivation_path="m/44'/60'/0'/0/0"
)
```

---

### restore_from_private_key()

Restore a wallet from a private key.

```python
def restore_from_private_key(private_key: str) -> WalletResult
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `private_key` | str | Private key (with or without 0x prefix) |

**Example:**
```python
from eth_toolkit import restore_from_private_key

# FAKE TEST KEY - DO NOT USE FOR REAL FUNDS
wallet = restore_from_private_key(\"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\")
print(f\"Address: {wallet.address}\")
```

---

### derive_multiple_accounts()

Derive multiple accounts from a single mnemonic.

```python
def derive_multiple_accounts(
    mnemonic: str,
    count: int = 10,
    passphrase: str = "",
    base_path: str = "m/44'/60'/0'/0"
) -> list[WalletResult]
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `mnemonic` | str | required | BIP39 mnemonic phrase |
| `count` | int | 10 | Number of accounts to derive |
| `passphrase` | str | "" | BIP39 passphrase |
| `base_path` | str | "m/44'/60'/0'/0" | Base derivation path |

**Example:**
```python
from eth_toolkit import derive_multiple_accounts

accounts = derive_multiple_accounts(mnemonic, count=5)
for i, account in enumerate(accounts):
    print(f"Account {i}: {account.address}")
```

---

## Vanity Address Generation

### generate_vanity_address()

Generate Ethereum addresses matching specific patterns.

```python
def generate_vanity_address(
    prefix: Optional[str] = None,
    suffix: Optional[str] = None,
    contains: Optional[str] = None,
    case_sensitive: bool = False,
    letters_only: bool = False,
    numbers_only: bool = False,
    mirror: bool = False,
    threads: int = 1,
    count: int = 1,
    callback: Optional[callable] = None
) -> list[VanityResult]
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prefix` | str | None | Desired prefix (after 0x) |
| `suffix` | str | None | Desired suffix |
| `contains` | str | None | Pattern that must appear anywhere |
| `case_sensitive` | bool | False | Match case exactly (EIP-55 checksum) |
| `letters_only` | bool | False | Address contains only a-f |
| `numbers_only` | bool | False | Address contains only 0-9 |
| `mirror` | bool | False | First half mirrors second half |
| `threads` | int | 1 | Number of parallel workers |
| `count` | int | 1 | Number of addresses to generate |
| `callback` | callable | None | Progress callback function |

**Example:**
```python
from eth_toolkit import generate_vanity_address

# Find address starting with "dead" and ending with "beef"
results = generate_vanity_address(
    prefix="dead",
    suffix="beef",
    threads=8
)

for result in results:
    print(f"Address: {result.address}")
    print(f"Found in {result.attempts} attempts ({result.time_seconds:.2f}s)")
```

---

### check_vanity_match()

Check if an address matches vanity criteria.

```python
def check_vanity_match(
    address: str,
    prefix: Optional[str] = None,
    suffix: Optional[str] = None,
    contains: Optional[str] = None,
    case_sensitive: bool = False,
    letters_only: bool = False,
    numbers_only: bool = False,
    mirror: bool = False
) -> bool
```

**Returns:** `True` if the address matches all criteria.

---

## Message Signing

### sign_message()

Sign a message with a private key (EIP-191).

```python
def sign_message(message: str, private_key: str) -> dict
```

**Returns:**
```python
{
    "message": str,           # Original message
    "signature": str,         # Full signature (hex)
    "r": str,                 # Signature r component
    "s": str,                 # Signature s component
    "v": int,                 # Recovery id
    "message_hash": str       # Keccak-256 hash of prefixed message
}
```

**Example:**
```python
from eth_toolkit import sign_message

result = sign_message("Hello, Ethereum!", private_key)
print(f"Signature: {result['signature']}")
```

---

### verify_message()

Verify a signed message and recover the signer's address.

```python
def verify_message(
    message: str,
    signature: str,
    expected_address: str
) -> dict
```

**Returns:**
```python
{
    "message": str,            # Original message
    "signature": str,          # Provided signature
    "expected_address": str,   # Address to verify against
    "recovered_address": str,  # Actual signer address
    "is_valid": bool           # True if addresses match
}
```

---

## Validation Functions

### is_valid_address()

Validate Ethereum address format.

```python
def is_valid_address(address: str) -> bool
```

**Validation Rules:**
- Must start with "0x"
- Must be exactly 42 characters
- Must contain only hex characters (0-9, a-f, A-F)

---

### is_valid_private_key()

Validate private key format.

```python
def is_valid_private_key(key: str) -> bool
```

**Validation Rules:**
- Must be 64 hex characters (with or without 0x prefix)

---

### validate_public_key()

Verify that a private key corresponds to an address.

```python
def validate_public_key(address: str, private_key: str) -> bool
```

**Returns:** `True` if the private key derives to the given address.

---

## Utility Functions

### estimate_difficulty()

Estimate the number of attempts needed to find a vanity address.

```python
def estimate_difficulty(
    prefix: Optional[str] = None,
    suffix: Optional[str] = None,
    contains: Optional[str] = None,
    case_sensitive: bool = False
) -> int
```

**Formula:**
- Case-insensitive: `16^n` where n = total pattern characters
- Case-sensitive: `22^n` (approximately, due to checksum rules)

---

### format_duration()

Format duration in human-readable form.

```python
def format_duration(seconds: float) -> str
```

**Returns:** String like "1.5s", "2.3m", "4.1h", or "1.2d"

---

## CLI Commands

The toolkit provides a command-line interface with the following commands:

| Command | Description |
|---------|-------------|
| `generate` | Generate a new random wallet |
| `vanity` | Generate vanity addresses |
| `restore` | Restore wallet from mnemonic or private key |
| `derive` | Derive multiple accounts from mnemonic |
| `sign` | Sign a message |
| `verify` | Verify a signed message |
| `validate` | Validate address or private key |

Run `python eth_toolkit.py <command> --help` for detailed usage.

