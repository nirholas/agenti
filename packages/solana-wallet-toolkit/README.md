# Solana Wallet Toolkit

[![Rust](https://img.shields.io/badge/rust-stable-orange.svg)](https://www.rust-lang.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solana](https://img.shields.io/badge/Solana-Official%20SDK-9945FF.svg)](https://solana.com/)

> **Secure, auditable toolkit for Solana wallet generation and vanity addresses — using only official Solana Labs libraries.**

### 🔑 Key Features

- **Vanity Address Generation** — Generate addresses with custom prefixes/suffixes
- **Multi-threaded Search** — Parallel generation using all CPU cores
- **Rust & TypeScript** — High-performance Rust CLI + Node.js library
- **Secure File Output** — Keypairs saved with 0600 permissions
- **Solana CLI Compatible** — Output format works with `solana` CLI tools
- **100% Offline** — No network calls, fully air-gappable
- **Auditable Code** — Clean, documented source code

---

## ⚠️ DISCLAIMER - EDUCATIONAL PURPOSES ONLY - NO LIABILITY

**THIS SOFTWARE IS PROVIDED FOR EDUCATIONAL AND RESEARCH PURPOSES ONLY.**

**DO NOT USE WITH REAL FUNDS WITHOUT THOROUGH SECURITY REVIEW.**

The author(s) accept **NO LIABILITY** for any damages, losses, or consequences arising from the use of this software. By using this software, you acknowledge that you are solely responsible for your actions and any outcomes.

This software is provided "AS IS" without warranty of any kind. The author(s) make no guarantees about the security, correctness, or fitness for any purpose.

**ALWAYS:**
- Audit the code yourself before any use
- Use hardware wallets for significant funds
- Understand that vanity address generation has inherent risks
- Generate keys on an air-gapped, offline machine

---

## 🔒 Security

This toolkit uses **ONLY official libraries from Solana Labs**. No third-party cryptographic code.

| Implementation | Library | Repository | Maintainer |
|----------------|---------|------------|------------|
| **Rust** | `solana-sdk` | [solana-labs/solana](https://github.com/solana-labs/solana) | Solana Labs |
| **TypeScript** | `@solana/web3.js` | [solana-labs/solana-web3.js](https://github.com/solana-labs/solana-web3.js) | Solana Labs |
| **Shell** | `solana-keygen` | [solana-labs/solana](https://github.com/solana-labs/solana) | Solana Labs |

All cryptographic operations (Ed25519 key generation, signing) are handled by these official packages. The toolkit code only provides CLI interface and pattern matching logic.

### Non-Cryptographic Dependencies

These standard libraries handle CLI, parallelism, and file I/O — **none touch private keys**:

| Package | Purpose | Used By |
|---------|---------|---------|
| `clap` | CLI argument parsing | Rust |
| `rayon` | Parallel processing | Rust |
| `serde` | JSON serialization | Rust |
| `zeroize` | Secure memory clearing | Rust |

### Security Best Practices

1. **Run offline** — Disconnect from the internet when generating wallets
2. **Audit the code** — It's open source, verify it yourself
3. **Never share private keys or keypair files**
4. **Store secrets securely** — Use hardware wallets for significant funds
5. **Verify file permissions** — Keypair files should be `0600` (owner read/write only)

---

## 📦 Installation

### Rust (Recommended - Fastest)

```bash
# Clone the repository
git clone https://github.com/nirholas/solana-wallet-toolkit.git
cd solana-wallet-toolkit/rust

# Build release binary
cargo build --release

# Binary is at target/release/solana-vanity
```

### TypeScript / Node.js

```bash
cd solana-wallet-toolkit/typescript

# Install dependencies
npm install

# Build
npm run build
```

### Shell Scripts (Uses solana-keygen)

```bash
# Requires Solana CLI tools installed
# https://docs.solana.com/cli/install-solana-cli-tools

cd solana-wallet-toolkit/scripts
chmod +x *.sh
```

---

## 🚀 Usage

### Rust CLI

```bash
# Generate address starting with "ABC"
./solana-vanity --prefix ABC

# Generate address ending with "XYZ"
./solana-vanity --suffix XYZ

# Both prefix and suffix
./solana-vanity --prefix AB --suffix 99

# Case-insensitive matching
./solana-vanity --prefix abc --ignore-case

# Specify number of threads
./solana-vanity --prefix ABC --threads 8

# Custom output file
./solana-vanity --prefix Sol --output my-wallet.json

# Generate multiple addresses
./solana-vanity --prefix A --count 5

# Estimate time without generating (dry run)
./solana-vanity --prefix ABCD --dry-run

# Quiet mode (just output public key)
./solana-vanity --prefix AB --quiet
```

### TypeScript CLI

```bash
# Using ts-node
npx ts-node src/index.ts --prefix ABC

# Or after building
node dist/index.js --prefix ABC --suffix XYZ
```

### TypeScript Library

```typescript
import { VanityGenerator } from 'solana-vanity-ts';

const generator = new VanityGenerator({
  prefix: 'Sol',
  ignoreCase: true,
  onProgress: (attempts, rate) => {
    console.log(`${attempts} attempts, ${rate}/sec`);
  }
});

const result = await generator.generate();
console.log(`Found: ${result.publicKey}`);
console.log(`Attempts: ${result.attempts}`);
```

### Shell Scripts

```bash
# Generate vanity address using solana-keygen grind
./scripts/generate-vanity.sh Sol

# Batch generate from file
./scripts/batch-generate.sh prefixes.txt

# Verify a keypair file
./scripts/verify-keypair.sh my-wallet.json
```

---

## ⏱️ Vanity Address Time Estimates

Solana addresses use Base58 encoding (58 possible characters per position).

| Characters | Difficulty | Est. Time (8 cores) |
|------------|------------|---------------------|
| 1 | 1 in 58 | Instant |
| 2 | 1 in 3,364 | < 1 second |
| 3 | 1 in 195,112 | ~2 seconds |
| 4 | 1 in 11,316,496 | ~2 minutes |
| 5 | 1 in 656,356,768 | ~2 hours |
| 6 | 1 in 38+ billion | ~4 days |
| 7+ | 1 in 2+ trillion | Weeks to months |

**Note:** Case-insensitive matching roughly doubles your chances for letter characters.

Times depend on your hardware. The Rust implementation typically achieves 50,000-100,000+ keys/second per thread.

---

## 📁 Project Structure

```
solana-wallet-toolkit/
├── rust/                    # High-performance Rust implementation
│   ├── src/
│   │   ├── main.rs          # CLI entry point
│   │   ├── lib.rs           # Library exports
│   │   ├── generator.rs     # Core generation logic
│   │   ├── matcher.rs       # Pattern matching
│   │   ├── output.rs        # File output (Solana CLI format)
│   │   └── security.rs      # Secure memory handling
│   ├── Cargo.toml
│   └── README.md
│
├── typescript/              # Node.js implementation
│   ├── src/
│   │   ├── index.ts         # CLI entry point
│   │   └── lib/
│   │       ├── generator.ts # Core generation logic
│   │       ├── matcher.ts   # Pattern matching
│   │       ├── output.ts    # File output
│   │       └── security.ts  # Security utilities
│   ├── package.json
│   └── README.md
│
├── scripts/                 # Shell script wrappers
│   ├── generate-vanity.sh   # Single address generation
│   ├── batch-generate.sh    # Batch generation
│   ├── verify-keypair.sh    # Keypair verification
│   └── utils.sh             # Shared utilities
│
├── tests/                   # Test suites
│   ├── cli/                 # CLI tests
│   ├── integration/         # Cross-implementation tests
│   ├── fuzz/                # Fuzz testing
│   └── stress/              # Stress tests
│
├── security/                # Security documentation
│   ├── SECURITY_CHECKLIST.md
│   └── audit-*.md
│
├── docs/                    # Documentation
│   └── cli-guide.md
│
└── tools/                   # Utility tools
    ├── verify-keypair.ts
    └── check-file-permissions.sh
```

---

## 🔍 How It Works

### Key Generation

1. Generate random Ed25519 keypair using `solana-sdk` / `@solana/web3.js`
2. Get the public key (32 bytes)
3. Encode as Base58 string (Solana address format)
4. Check if address matches the pattern
5. Repeat until match found

### Pattern Matching

- **Prefix**: Check if address starts with the pattern
- **Suffix**: Check if address ends with the pattern
- **Case-insensitive**: Compare lowercase versions

### Output Format

Keypairs are saved in Solana CLI JSON format — a JSON array of 64 bytes:
- Bytes 0-31: Ed25519 secret key seed
- Bytes 32-63: Public key

```json
[174,47,154,16,202,193,206,113,199,190,53,133,169,175,31,56,...]
```

This format is compatible with `solana config set --keypair` and other Solana CLI tools.

---

## 🆚 Comparison with Other Tools

| Feature | This Toolkit | solana-keygen grind | Others |
|---------|-------------|---------------------|--------|
| **Library** | Official solana-sdk | Official | Varies |
| **Languages** | Rust, TypeScript, Shell | Rust | Varies |
| **Multi-threaded** | Yes | Yes | Some |
| **Prefix/Suffix** | Yes | Prefix only | Some |
| **Case-insensitive** | Yes | No | Some |
| **Secure Permissions** | Yes (0600) | Yes | Rarely |
| **Memory Zeroization** | Yes | Yes | Rarely |
| **Dry Run/Estimate** | Yes | No | Rarely |
| **Library API** | Yes | No | Some |
| **Auditable** | Yes | Yes | Varies |

---

## 🧪 Testing

```bash
# Run all tests
./run-all-tests.sh

# Rust tests
cd rust && cargo test

# TypeScript tests
cd typescript && npm test

# Integration tests
./tests/integration/test_keypair_validity.sh
./tests/integration/test_output_compatibility.sh
```

---

## 🤖 For AI / LLM / Vibe Coders

### Quick Copy-Paste Examples

**Rust:**
```rust
use solana_sdk::signer::keypair::Keypair;
use solana_sdk::signature::Signer;

// Generate random keypair
let keypair = Keypair::new();
println!("Address: {}", keypair.pubkey());

// Save to file (Solana CLI format)
let bytes = keypair.to_bytes();
let json = serde_json::to_string(&bytes.to_vec())?;
std::fs::write("keypair.json", json)?;
```

**TypeScript:**
```typescript
import { Keypair } from '@solana/web3.js';

// Generate random keypair
const keypair = Keypair.generate();
console.log('Address:', keypair.publicKey.toBase58());

// Save to file
const json = JSON.stringify(Array.from(keypair.secretKey));
fs.writeFileSync('keypair.json', json, { mode: 0o600 });
```

---

## 📜 License

MIT License — See [LICENSE](LICENSE) for details.

---

## 👤 Author

**nich** — [@nichxbt](https://x.com/nichxbt) — [github.com/nirholas](https://github.com/nirholas)

---

## 🔗 Related Projects

- **[ethereum-wallet-toolkit](https://github.com/nirholas/ethereum-wallet-toolkit)** — Similar toolkit for Ethereum

---

## 📚 Resources

- [Solana Documentation](https://docs.solana.com/)
- [solana-sdk on crates.io](https://crates.io/crates/solana-sdk)
- [@solana/web3.js on npm](https://www.npmjs.com/package/@solana/web3.js)
- [Ed25519 Specification](https://ed25519.cr.yp.to/)
- [Base58 Encoding](https://en.wikipedia.org/wiki/Binary-to-text_encoding#Base58)

---

### 🏷️ Keywords

`solana` `wallet` `rust` `typescript` `cli` `vanity-address` `keypair` `ed25519` `private-key` `address-generator` `solana-sdk` `web3js` `cryptocurrency` `blockchain` `cold-storage` `offline-wallet` `air-gapped` `open-source` `educational`

---

<p align="center">
  <b>⭐ Star this repo if you find it useful!</b><br>
  <sub>Educational tool for understanding Solana wallet mechanics</sub>
</p>