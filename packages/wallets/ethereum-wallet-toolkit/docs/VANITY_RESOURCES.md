# Vanity Address Research & Security Resources

> **DISCLAIMER: FOR EDUCATIONAL PURPOSES ONLY**
> 
> This software is provided for educational and research purposes only.
> DO NOT USE WITH REAL FUNDS. The author accepts NO LIABILITY for any damages.
> All example addresses shown are for illustrative purposes only.

A comprehensive compilation of research papers, technical articles, and security analyses related to cryptocurrency vanity addresses, their generation, vulnerabilities, and associated attack vectors.

---

## Table of Contents

1. [Introduction](#introduction)
2. [What Are Vanity Addresses?](#what-are-vanity-addresses)
3. [Generation Methods](#generation-methods)
4. [Security Vulnerabilities](#security-vulnerabilities)
5. [Address Poisoning Attacks](#address-poisoning-attacks)
6. [Arbitrage Ecosystem Context](#arbitrage-ecosystem-context)
7. [Cryptocurrency Derivatives & Market Context](#cryptocurrency-derivatives--market-context)
8. [Safe Usage Guidelines](#safe-usage-guidelines)
9. [Notable Incidents](#notable-incidents)
10. [Works Cited](#works-cited)

---

## Introduction

Vanity addresses are custom cryptocurrency wallet addresses created using specific algorithms to incorporate user-chosen character sequences. While they serve legitimate purposes such as gas optimization, protocol branding, and multichain reproducibility, they have also been associated with significant security vulnerabilities and attack vectors.

This document compiles research from academic papers, security analyses, and technical blog posts to provide a comprehensive understanding of vanity addresses in the cryptocurrency ecosystem.

---

## What Are Vanity Addresses?

### Definition

When generating a cryptocurrency wallet, the system produces an address composed of a random string of characters. These default addresses lack personal significance. A vanity address is a custom address generated using specific algorithms that incorporate a user-chosen sequence of characters into the wallet address.

### Common Use Cases

1. **Gas Optimization**: Transaction gas costs decrease if an address has leading zeros. According to the Ethereum yellowpaper, leading zeros are cheaper for gas calculations. Wintermute reportedly saved $15,000 in gas costs due to their EOA having leading zeros (foobar).

2. **Protocol Branding**: Companies use vanity addresses for easy recognition. For example, protocols often use addresses starting with recognizable patterns like `0x1111...` or `0x0000...` for branding.

3. **Multichain Reproducibility**: Protocols can deploy to multiple EVM chains with the same contract address, simplifying documentation and user experience.

### Technical Characteristics

Creating vanity addresses is computationally intensive. The algorithm must try many combinations before finding an address that includes the chosen string of characters. The higher the number of prefixes and suffixes requested, the more time and computational resources required.

For reference, using optimized GPU mining (RTX 3090 at ~2 billion attempts/second):
- 5-leading-zero-byte address: ~8 minutes
- 6-leading-zero-byte address: ~36 hours  
- 7-leading-zero-byte address: ~387 days

---

## Generation Methods

### Profanity Generator

Profanity is an open-source vanity address generator. The basic workflow:
1. A "random" private key is generated
2. The corresponding Ethereum address is calculated
3. The address is compared against the user's desired pattern
4. If not matched, the private key is incremented by one and the process repeats
5. GPUs accelerate this process to hundreds of millions of checks per second

**Critical Flaw**: The profanity code uses a pseudo-random number generator called `mt19937`, which only outputs 8 bytes at a time and takes a 4-byte unsigned int seed (fed by a `random_device` call). Since Ethereum private keys are 32 bytes, the code must combine 4 outputs. The `mt19937_64` generator is only seeded once, so outputs don't change if the input seed is reused. This reduces complexity from 2^256 to 2^32 (James).

### CREATE vs CREATE2 Deployment

**CREATE (Default)**:
```
new_address = hash(sender, nonce)
```
- Address determined by hashing contract creator address with creator nonce
- Nonce increments with each transaction
- Vulnerable to ordering mistakes across chains

**CREATE2 (Recommended for Vanity)**:
```
new_address = hash(0xFF, sender, salt, bytecode)
```
- Uses a user-chosen salt for vanity address generation
- Salt can be made public without security risk
- Enables permissionless deployment across chains
- Bytecode parameter ensures identical functionality across chains

### Safe Generation Tools

- **create2crunch**: GPU-optimized tool for finding CREATE2 salts
- **CREATE2 Factory**: A common CREATE2 factory contract is deployed on many EVM chains

---

## Security Vulnerabilities

### The Profanity Vulnerability (CVE-2022-XXXXX)

The fundamental flaw in Profanity's random number generation:

```cpp
// Vulnerable code from Dispatcher.cpp
// Uses mt19937 with only 4-byte seed
// Reduces keyspace from 2^256 to 2^32
```

**Impact**: All starting private keys that could be generated by this program can be generated and saved in just a few hours using less than 2TB of hard drive space (James).

### EOA vs Smart Contract Safety

**EOAs (Externally Owned Accounts)**: 
- **UNSAFE** for vanity generation
- Private key controls funds
- If randomness is compromised, entire account is ruined

**Smart Contract Accounts**:
- **SAFE** for vanity generation
- Only requires iterating through public seeds
- Seeds do not grant admin permissions

As stated by foobar: "EOA vanity is the road to bankruptcy, smart contract vanity is the road to success."

### Exchange Attribution in Arbitrage Research

Research from UCSB identified 50,081 addresses as decentralized exchanges through arbitrage detection. Attribution was done by:
- Checking for smart contract source code
- Vanity address labels added to Etherscan
- Automated scanning for Uniswap v2 clone factory event logs

This research revealed 180 unique Uniswap v2 factories, demonstrating how vanity addresses can be used for exchange identification (McLaughlin et al. 3299).

---

## Address Poisoning Attacks

### Overview

Address poisoning aims to create a vanity address resembling a legitimate wallet that the target frequently interacts with. The attacker then:
1. Transfers scam tokens mimicking legitimate ones
2. Or sends low/no value coin transfers
3. These transactions "poison" the target's transaction history
4. The victim may copy the wrong address for future transactions

Typically, the first 4-6 characters and last 4-6 characters are made to resemble the target address.

**Example** (FAKE illustrative addresses):
- Legitimate: `0xABCD1234ABCD1234ABCD1234ABCD1234ABCD1234`
- Attacker: `0xABCD5678000056780000567800005678ABCD5678`

(Notice first 4 and last 4 characters match)

### Attack Techniques

#### Fake Token Transfers

Attackers send fake tokens (e.g., fake USDT) to wallets with addresses similar to ones that received legitimate tokens. These fake token contracts may:
- Allow transfers without owning the token
- Have token balances stored in contract storage without mint transactions
- Use unverified contracts

#### Zero Value Spam

With tokens like USDT, transferring 0 amount records on the ledger. Scammers:
1. Spoof transactions to appear as if the target is sending zero value
2. Create vanity addresses mimicking legitimate recipients
3. Sometimes send small amounts (<$10 USDC) to avoid detection flags

### Major Incident: May 3, 2024

A victim lost 1,155 WBTC (~$72M) by copying the wrong address from their transaction history. Remarkably, the stolen funds were eventually returned to the victim (CertiK).

---

## Arbitrage Ecosystem Context

### DEX Arbitrage and Vanity Addresses

Research from McLaughlin et al. at UCSB conducted a 28-month study (February 2020 - July 2022) analyzing the Ethereum arbitrage ecosystem. Key findings relevant to vanity addresses:

#### Exchange Identification
- 50,081 addresses identified as DEXs
- Manual examination used vanity address labels on Etherscan
- 180 unique Uniswap v2 factories discovered

#### Arbitrage Statistics
- 3.8 million arbitrages identified
- $321 million in total profit
- 4 billion arbitrage opportunities detected
- Weekly profit potential: 395 Ether (~$500,000)

#### Exchange Distribution (by frequency in arbitrage)
| Exchange | Usage % |
|----------|---------|
| Uniswap v2 | 44.9% |
| Uniswap v3 | 15.2% |
| Sushi Swap | 13.5% |
| Balancer v1 | 10.8% |
| Unknown | 5.4% |

#### Arbitrage Cycle Properties
- 98% contain exactly one exchange cycle
- 91% use either two or three exchanges
- 92% use Wrapped Ether (WETH) as profit token

### Security Implications

The research identified threats to consensus stability:
- Increasing percentage of arbitrage revenue paid to miners/validators
- This could incentivize "time-bandit attacks" where block producers fork the blockchain to capture high-value MEV blocks

---

## Cryptocurrency Derivatives & Market Context

### BitMEX Case Study

Research from Soska et al. at Carnegie Mellon University provides context on how vanity addresses are used in the broader cryptocurrency trading ecosystem.

#### Platform Characteristics
- Trades over $3 billion daily volume
- Up to 100x leverage on Bitcoin
- Over 600,000 trader accounts
- All operations in Bitcoin (no fiat conversion)

#### Vanity Address Usage
BitMEX uses vanity addresses for customer deposit accounts:
- Unique `3BMEX` prefix for all customer addresses
- 610,000+ addresses with this prefix identified
- Used for automated account identification and filtering

#### Clustering Analysis
The researchers developed methods to cluster BitMEX accounts:
1. Rule-based clustering using deposit transaction patterns
2. Community detection via Label Propagation algorithm
3. Service detection to filter exchanges and dusters

Results showed sophisticated traders operating multiple accounts:
- 90% of accounts are singletons
- <1% belong to clusters of 5+ accounts
- Largest clusters contain 50+ accounts

### Trader Sophistication Indicators

Analysis of vanity address clusters revealed:
- Larger clusters have higher average deposits
- Multiple accounts used to circumvent leverage restrictions
- API rate limit multiplexing
- Flow obfuscation to prevent front-running

---

## Safe Usage Guidelines

### For EOAs (Externally Owned Accounts)

**DO NOT use vanity generators for EOAs**. The only truly reliable method is to generate addresses yourself with cryptographically secure randomness. Even then, vulnerabilities in generation software can compromise security.

### For Smart Contracts

Smart contract vanity addresses are safe when using CREATE2:

1. Use a CREATE2 factory contract
2. Choose a salt that produces desired address characteristics
3. Salt can be made public without security implications
4. Verify bytecode matches across all chain deployments

### Proper Random Number Generation Fix

To fix the Profanity vulnerability, proper seeding is required:

```cpp
// Instead of single 4-byte seed
// Use 624-word seed for mt19937
// Or use cryptographically secure RNG
```

The fix requires feeding a random seed sequence of at least 32 bits to ensure mt19937 produces cryptographically secure outputs (James).

### User Protection Against Address Poisoning

1. **Always double-check full addresses** before sending funds
2. Use address books/whitelists in wallet software
3. Be suspicious of unfamiliar tokens in transaction history
4. Verify addresses through multiple sources
5. Use blockchain explorers that flag suspicious addresses

---

## Notable Incidents

### Wintermute Hack (September 2022)
- **Loss**: $160 million
- **Cause**: Bad randomness in Profanity vanity address generator
- **Method**: Attacker replayed search iteration to recreate (private key, public address) pair
- **Target**: EOA with leading zeros for gas optimization

### Indexed Finance Exploiter (October 2021 → September 2022)
- **Initial Exploit**: $16 million stolen
- **Address**: Started with `0xba5ed...` ("based")
- **Irony**: Same Profanity vulnerability exploited
- **Result**: All funds stolen again by another attacker

### Address Poisoning Victim (May 3, 2024)
- **Loss**: 1,155 WBTC (~$72 million)
- **Cause**: Copied wrong address from transaction history
- **Outcome**: Funds eventually returned

---

## Technical Appendix

### CREATE2 Salt Mining

Using create2crunch on vast.ai (RTX 3090):

```bash
# Install
sudo apt install build-essential -y
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
git clone https://github.com/0age/create2crunch && cd create2crunch
sed -i 's/0x4/0x40/g' src/lib.rs

# Run search
export FACTORY="0xYourFactoryAddress"
export CALLER="0xYourCallerAddress"
export INIT_CODE_HASH="0xYourInitCodeHash"
export LEADING=5
export TOTAL=7
cargo run --release $FACTORY $CALLER $INIT_CODE_HASH 0 $LEADING $TOTAL
```

### Keyless Transaction Deployment

The CREATE2 Factory uses ENS founder Nick Johnson's "keyless transaction" approach:
1. Create deployment transaction
2. Generate fake signature (e.g., all 2's)
3. Recover public address from signature
4. Send ETH to that address
5. Submit signed transaction to mempool

This creates a single-use EOA that can only ever deploy one transaction.

---

## Works Cited

CertiK. "Vanity Address and Address Poisoning." *CertiK Resources*, 29 July 2024, www.certik.com/resources/blog/vanity-address-and-address-poisoning.

foobar. "Vanity Addresses: The Only Safe Way to Do Permissionless Multichain Deployments." *0xfoobar Substack*, 10 Jan. 2023, 0xfoobar.substack.com/p/vanity-addresses.

Garreau, Marc. "Web3.py Patterns: Address Mining." *Snake Charmers (Ethereum Foundation)*, 4 Oct. 2021, snakecharmers.ethereum.org/web3-py-patterns-address-mining/.

James. "Fixing Other People's Code." *Oregon State University Blogs*, 6 Feb. 2023, blogs.oregonstate.edu/james/2023/02/.

McLaughlin, Robert, et al. "A Large Scale Study of the Ethereum Arbitrage Ecosystem." *32nd USENIX Security Symposium*, 9-11 Aug. 2023, Anaheim, CA, USA, pp. 3295-3312. USENIX Association, www.usenix.org/conference/usenixsecurity23/presentation/mclaughlin.

Soska, Kyle, et al. "Towards Understanding Cryptocurrency Derivatives: A Case Study of BitMEX." *Proceedings of the Web Conference 2021 (WWW '21)*, 19-23 Apr. 2021, Ljubljana, Slovenia. ACM, New York, NY, USA, doi.org/10.1145/3442381.3450059.

---

## Additional References

### From McLaughlin et al. Paper

- Daian, Philip, et al. "Flash Boys 2.0: Frontrunning in Decentralized Exchanges, Miner Extractable Value, and Consensus Instability." *2020 IEEE Symposium on Security and Privacy (SP)*, 2020, pp. 910-927.

- Qin, Kaihua, et al. "Quantifying Blockchain Extractable Value: How Dark Is the Forest?" *2022 IEEE Symposium on Security and Privacy (SP)*, 2022, pp. 198-214.

- Wang, Ye, et al. "Cyclic Arbitrage in Decentralized Exchanges." *Companion Proceedings of the Web Conference 2022 (WWW '22)*, 2022, pp. 12-19. ACM.

- Zhou, Liyi, et al. "On the Just-in-Time Discovery of Profit-Generating Transactions in DeFi Protocols." *2021 IEEE Symposium on Security and Privacy (SP)*, 2021, pp. 919-936.

### From Soska et al. Paper

- Gandal, Neil, et al. "Price Manipulation in the Bitcoin Ecosystem." *Journal of Monetary Economics*, vol. 95, 2018, pp. 86-96.

- Meiklejohn, Sarah, et al. "A Fistful of Bitcoins: Characterizing Payments Among Men with No Names." *Proceedings of the 2013 Internet Measurement Conference*, 2013, pp. 127-140.

- Nakamoto, Satoshi. "Bitcoin: A Peer-to-Peer Electronic Cash System." 2008.

---

*Document compiled: January 2026*

*For the ethereum-wallet-toolkit project*
