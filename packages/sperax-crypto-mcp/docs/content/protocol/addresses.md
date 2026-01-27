# Contract Addresses

Sperax protocol contracts across supported chains.

---

## Arbitrum One (Chain ID: 42161)

Primary deployment for USDs stablecoin and DeFi protocol.

### Core Protocol

| Contract | Address | Description |
|----------|---------|-------------|
| USDs | `0xD74f5255D557944cf7Dd0E45FF521520002D5748` | Auto-yield stablecoin |
| SPA | `0x5575552988A3A80504bBaeB1311674fCFd40aD4B` | Governance token |
| Vault | `0x6Bbc476Ee35CBA9e9c3A59fc5b10d7a0BC6f74Ca` | Mint/redeem USDs |
| Collateral Manager | `0xdA6B48BA29fE5F0f32eB52FBA21D26DACA04E5e7` | Collateral config |
| Fee Calculator | `0xC2C3D9F5C5A5dE5A5a5c5D5e5F5A5b5c5D5E5F5a` | Dynamic fees |

### Staking

| Contract | Address | Description |
|----------|---------|-------------|
| veSPA | `0x2e2071180682Ce6C247B1eF93d382D509F5F6A17` | Vote-escrowed SPA |
| xSPA | `0x0966E72256d6055145902F72F9D3B6a194B9cCc3` | Reward token |

### Yield Distribution

| Contract | Address | Description |
|----------|---------|-------------|
| SPA Buyback | `0xFbc0d3cA777722d234FE01dba94DeDeDb277AFe3` | Buy & burn SPA |
| Yield Reserve | `0x0CB89A7A6a9E0d9E06EE0c52De040db0e2B079E6` | Yield collection |
| Dripper | `0xEaA79893D17d4c1b3e76c684e7A89B3D46a6fb03` | Yield drip to rebase |
| Rebase Manager | `0xC21b3b55Db3cb0B6CA6F96c18E9534c96E1d4cfc` | Rebase orchestration |

### Oracles

| Contract | Address | Description |
|----------|---------|-------------|
| Master Price Oracle | `0x14D99412dAB1878dC01Fe7a1664cdE85896e8E50` | Aggregated prices |
| Chainlink Oracle | `0xB9e5A70e1B1F3C99Db6Ed28f67d8d7d1248F8b3B` | Chainlink adapter |
| SPA Oracle | `0x5Fb534B4B07a0E417B449E264A8c7A6f9C5C2C69` | SPA price feed |
| USDs Oracle | `0x1C27c2a4aD63DE5F44f5a0e7a651e3FC7F3BBBe3` | USDs price feed |

---

## BNB Smart Chain (Chain ID: 56)

SPA token deployment on BSC.

| Contract | Address | Description |
|----------|---------|-------------|
| SPA | `0x1A9Fd6eC3144Da3Dd6Ea13Ec1C25C58423a379b1` | SPA token (proxy) |

**Block Explorer**: [BscScan](https://bscscan.com/token/0x1a9fd6ec3144da3dd6ea13ec1c25c58423a379b1)

---

## Chainlink Price Feeds (Arbitrum)

| Pair | Address | Heartbeat |
|------|---------|-----------|
| USDC/USD | `0x50834F3163758fcC1Df9973b6e91f0F0F0363003` | 24h |
| USDT/USD | `0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7` | 24h |
| DAI/USD | `0xc5C8E77B397E531B8EC06BFb0048328B30E9eCfB` | 24h |
| FRAX/USD | `0x0809E3d38d1B4214958faf06D8b1B1a2b73f2ab8` | 24h |
| ETH/USD | `0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612` | 1h |

---

## Yield Strategies

| Contract | Address | Protocol | Collaterals |
|----------|---------|----------|-------------|
| Aave Strategy | `0x5E8422345238F34275888049021821E8E08CAa1f` | Aave V3 | USDC, USDC.e, USDT |
| Compound Strategy | `0x8c9532a60E0E7C6BbD2B2c1303F63aCE1c3e9811` | Compound V3 | USDC, USDC.e |
| Stargate Strategy | `0x6cD7bEF920f4C05aF3386A2c0070e1e26CD85c85` | Stargate | USDC.e, USDT |
| Fluid Strategy | `0xE0f51Ec5f35B0D7Ce31b26b8C15b9B9f3fF1f5C5` | Fluid | USDC, USDC.e, USDT |

---

## Demeter Protocol

| Contract | Address | Description |
|----------|---------|-------------|
| Farm Registry | `0x45bC6B44107837E7aBB21E2CaCbe7612Fce222e0` | Tracks all farms |
| Rewarder Factory | `0x926477bAF60C25857419CC9Bf52E914881E1bDD3` | Creates rewarders |
| UniV3 Farm Deployer | `0x0d9EFD8f11c0a09DB8C2CCBfF4cC6c26Ad98b956` | Uniswap V3 farms |
| CamelotV3 Deployer | `0xc6EcFBAE9e30E2B8D58AE0BBa29e0D0B3e8a8F8b` | Camelot V3 farms |

---

## Supported Collateral Tokens

| Token | Address | Decimals | Type |
|-------|---------|----------|------|
| USDC (Native) | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | 6 | Native |
| USDC.e (Bridged) | `0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8` | 6 | Bridged |
| USDT | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` | 6 | Native |
| DAI | `0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1` | 18 | Bridged |
| FRAX | `0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F` | 18 | Native |

---

## Infrastructure

| Contract | Address | Description |
|----------|---------|-------------|
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` | Batch calls |
| Sperax Deployer | `0x42d2f9f84EeB86574aA4E9FCccfD74066d809600` | Official deployer |

---

## Governance

| Resource | Link |
|----------|------|
| Snapshot Space | `speraxdao.eth` |
| Snapshot URL | https://snapshot.org/#/speraxdao.eth |
| Forum | https://forum.sperax.io |

---

## Block Explorers

| Network | Explorer |
|---------|----------|
| Arbitrum One | https://arbiscan.io |
| USDs Token | https://arbiscan.io/token/0xD74f5255D557944cf7Dd0E45FF521520002D5748 |
| SPA Token | https://arbiscan.io/token/0x5575552988A3A80504bBaeB1311674fCFd40aD4B |

---

## Verification

All contracts are verified on Arbiscan. To verify addresses:

1. Check official docs: https://docs.sperax.io
2. Check GitHub: https://github.com/Sperax
3. Cross-reference with Sperax Deployer address

---

## TypeScript Config

```typescript
export const CONTRACTS = {
  // Core Protocol
  USDS: '0xD74f5255D557944cf7Dd0E45FF521520002D5748',
  SPA: '0x5575552988A3A80504bBaeB1311674fCFd40aD4B',
  VAULT: '0x6Bbc476Ee35CBA9e9c3A59fc5b10d7a0BC6f74Ca',

  // Staking
  VESPA: '0x2e2071180682Ce6C247B1eF93d382D509F5F6A17',
  XSPA: '0x0966E72256d6055145902F72F9D3B6a194B9cCc3',

  // Yield Distribution
  SPA_BUYBACK: '0xFbc0d3cA777722d234FE01dba94DeDeDb277AFe3',
  YIELD_RESERVE: '0x0CB89A7A6a9E0d9E06EE0c52De040db0e2B079E6',
  DRIPPER: '0xEaA79893D17d4c1b3e76c684e7A89B3D46a6fb03',
  REBASE_MANAGER: '0xC21b3b55Db3cb0B6CA6F96c18E9534c96E1d4cfc',

  // Collateral Manager
  COLLATERAL_MANAGER: '0xdA6B48BA29fE5F0f32eB52FBA21D26DACA04E5e7',

  // Oracles
  MASTER_PRICE_ORACLE: '0x14D99412dAB1878dC01Fe7a1664cdE85896e8E50',

  // Demeter
  FARM_REGISTRY: '0x45bC6B44107837E7aBB21E2CaCbe7612Fce222e0',
  REWARDER_FACTORY: '0x926477bAF60C25857419CC9Bf52E914881E1bDD3',

  // Collaterals
  USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  USDCe: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
  FRAX: '0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F',
} as const;
```
