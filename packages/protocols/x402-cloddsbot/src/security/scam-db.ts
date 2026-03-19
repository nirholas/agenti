// =============================================================================
// SECURITY SHIELD — Persistent Scam Database
// =============================================================================
// In-memory Map seeded with known scam/exploit addresses sourced from
// Etherscan labels, Mandiant/Google Cloud, Check Point Research, CertiK,
// Scam Sniffer, and security post-mortems. O(1) lookups.

import type { ChainType, ScamEntry, ScamType } from './types.js';

// ── Internal store ───────────────────────────────────────────────────────────

const db = new Map<string, ScamEntry>();

function seed(address: string, chain: ChainType, type: ScamType, label: string, severity = 100): void {
  db.set(address.toLowerCase(), { address, chain, type, label, severity, addedAt: Date.now() });
}

// ── EVM Drainers — Inferno Drainer (Check Point Research, Scam Sniffer) ─────

seed('0x000056c346441ef8065e56b0cddd43fdec100000', 'evm', 'drainer', 'Inferno Drainer Contract 1');
seed('0x0000daf60a1becf1bd617c584dea964455890000', 'evm', 'drainer', 'Inferno Drainer Contract 2');
seed('0x000062accd1a9d62ef428ec86ca3dd4f45120000', 'evm', 'drainer', 'Inferno Drainer Contract 3');
seed('0x00001f78189be22c3498cff1b8e02272c3220000', 'evm', 'drainer', 'Inferno Drainer Contract 4');
seed('0xfb4d3eb37bde8fa4b52c60aabe55b3cd9908ec73', 'evm', 'drainer', 'inferno-drainer-2.eth');
seed('0x158862ec60b7934f1333e53ac1e148811a2e3beb', 'evm', 'drainer', 'Inferno Drainer RemotePatchConfig');
seed('0xd24aec3254652b0ab565e41a945b491e98bb5ffc', 'evm', 'drainer', 'Inferno Drainer C&C Config');
seed('0x72cd63650700e5395f4ab238cecd18497a33a83e', 'evm', 'drainer', 'Inferno Drainer Config Storage');
seed('0xe9d5f645f79fa60fca82b4e1d35832e43370feb0', 'evm', 'drainer', 'Inferno Drainer C&C Resolver');
seed('0x00f8ea4c5793d94b2af416f76817f3afb44b0f4f', 'evm', 'drainer', 'Inferno Drainer Legacy 1');
seed('0x022b8d5ec68dd20e18db8af0e7bcff5081ce69dc', 'evm', 'drainer', 'Inferno Drainer Legacy 2');
seed('0x9b435747bcab40a0dd365804955541face3c2f3f', 'evm', 'drainer', 'Inferno Drainer Legacy 3');
seed('0xa02a8803a51f9012f6abbca1a4b6e66cc5419b23', 'evm', 'drainer', 'Inferno Drainer Legacy 4');
seed('0x0000db5c8b030ae20308ac975898e09741e70000', 'evm', 'drainer', 'Inferno Drainer (Optimism)');

// ── EVM Drainers — Pink Drainer (Etherscan-tagged) ──────────────────────────

seed('0x63605e53d422c4f1ac0e01390ac59aaf84c44a51', 'evm', 'drainer', 'PinkDrainer: Wallet 1 (pink-drainer.eth)');
seed('0x9fa7bb759641fcd37fe4ae41f725e0f653f2c726', 'evm', 'drainer', 'PinkDrainer: Wallet 2');
seed('0xa5e4b451d0a3c3d05fc3a8076fda45952b8f4f83', 'evm', 'drainer', 'Pink Drainer 0xa5e4');
seed('0x00000f312c54d0dd25888ee9cdc3dee988700000', 'evm', 'drainer', 'PinkDrainer: Contract 1');
seed('0x5408eb7d0c5dd4a4073565cc009c0e04f922858d', 'evm', 'drainer', 'Pink Drainer Customer 0x5408');

// ── EVM Drainers — Monkey, Angel, Venom, MS (Etherscan/ZachXBT) ─────────────

seed('0x9fc8265f2b376084423a1a348a89ecd894a9d106', 'evm', 'drainer', 'monkey-drainer.eth (ZachXBT)');
seed('0x5e0102e6448b602fcd955fcfc7ceea9a36e7e5f0', 'evm', 'drainer', 'Monkey Drainer Contract');
seed('0x0000626d6dc72989e3809920c67d01a7fe030000', 'evm', 'drainer', 'Angel Drainer: Phishing Contract 9');
seed('0x0000c3ace9e31a26ce1870d418cb045d73b30000', 'evm', 'drainer', 'Angel Drainer: Phishing Contract 3');
seed('0x00003ec25cb13f3f5f991d2f49c15f0763a40000', 'evm', 'drainer', 'Angel Drainer: Phishing Contract 7');
seed('0x412f10aad96fd78da6736387e2c84931ac20313f', 'evm', 'drainer', 'Angel Drainer: 0x412f');
seed('0xbaee148df4bf81abf9854c9087f0d3a0ffd93dbb', 'evm', 'drainer', 'Angel Drainer Safe Vault ($403K stolen)');
seed('0xaa336c6c9d11fa74eae5625467fd095c31bd1129', 'evm', 'drainer', 'VenomDrainer: ETH Pool');
seed('0xa2c0946ad444dccf990394c5cbe019a858a945bd', 'evm', 'drainer', 'Etherscan-flagged Drainer');
seed('0x4a96e9b57a229d94c0c28950355a72fa9e70aae3', 'evm', 'drainer', 'Etherscan-flagged Phishing');
seed('0x11cce5830e5753b9eec2c08a0be7cc6d3734c1bc', 'evm', 'drainer', 'scam-alert.eth');

// ── EVM Phishing / Fake Airdrop (Etherscan Fake_Phishing labels) ─────────────

seed('0x00000c07575bb4e64457687a0382b4d3ea470000', 'evm', 'phishing', 'Fake_Phishing184810');
seed('0x09b5027ef3a3b7332ee90321e558bad9c4447afa', 'evm', 'phishing', 'Fake_Phishing5875');
seed('0xd13b093eafa3878de27183388fea7d0d2b0abf9e', 'evm', 'phishing', 'Fake_Phishing6102');
seed('0x3e0defb880cd8e163bad68abe66437f99a7a8a74', 'evm', 'phishing', 'Fake_Phishing5169');
seed('0x62ebf2c09ae1de2aa4003d340a7df2afff5d40b0', 'evm', 'phishing', 'Phishing Token Deployer 20');
seed('0x44a7ff01f7d38c73530c279e19d31527bdcf8c78', 'evm', 'phishing', 'Fake_Phishing99');
seed('0x000011387eb24f199e875b1325e4805efd3b0000', 'evm', 'phishing', 'Fake_Phishing182233');
seed('0x219b9040eb7d8d8c2e8e84b87ce9ac1c83071980', 'evm', 'phishing', 'Etherscan-flagged Phishing');

// ── EVM Rug Pull Deployers (Etherscan/BscScan-documented) ────────────────────

seed('0x1f5eabba9c56bca4a7828969b79bc87051125b31', 'evm', 'rug_pull', 'Squid Game Token Rug 1 (BSC)');
seed('0x34400280a169f4685193926a513618cf7fe7f0aa', 'evm', 'rug_pull', 'Squid Game Token Rug 2 (BSC)');
seed('0x872254d530ae8983628cb1eaafc51f78d78c86d9', 'evm', 'rug_pull', 'AnubisDAO Rug 1 ($60M)');
seed('0x9fc53c75046900d1f58209f50f534852ae9f912a', 'evm', 'rug_pull', 'AnubisDAO Rug 2 ($60M)');
seed('0xb1302743acf31f567e9020810523f5030942e211', 'evm', 'rug_pull', 'AnubisDAO Rug 3 ($60M)');
seed('0x87230146e138d3f296a9a77e497a2a83012e9bc5', 'evm', 'rug_pull', 'Squid Game Token Contract (BSC)');
seed('0x00ccc5fe33fa66847082af413d4a8700cd7cde16', 'evm', 'rug_pull', 'Etherscan-tagged Rug Address');
seed('0xb34bdd3ee8052ae48ae865a93cc18bd9b06bd2a6', 'evm', 'rug_pull', 'rug.pull (RUG) Token');

// ── EVM Honeypot Contracts (Etherscan-tagged) ────────────────────────────────

seed('0x34c6211621f2763c60eb007dc2ae91090a2d22f6', 'evm', 'honeypot', 'BELLE Honeypot Rug Pull');
seed('0x80e4f014c98320eab524ae16b0aaf1603f4dc01d', 'evm', 'honeypot', 'Compromised Honeypot 2');
seed('0x2f30ff3428d62748a1d993f2cc6c9b55df40b4d7', 'evm', 'honeypot', 'Etherscan-tagged Honeypot');
seed('0x45dac6c8776e5eb1548d3cdcf0c5f6959e410c3a', 'evm', 'honeypot', 'Etherscan-tagged Honeypot Token');
seed('0x689591f8e8d4a54425a8311d0b0da3bf8e9cf0c0', 'evm', 'honeypot', 'Squid Game Token (buy-only honeypot)');
seed('0x6e988f0cb3d1118c9038ca04a5eb7bad737d39e6', 'evm', 'honeypot', 'BSC Squid Game (anti-sell)');

// ── Famous Exploits — EVM (post-mortems, Chainalysis, Etherscan) ─────────────

seed('0x629e7Da20197a5429d30da36E77d06CdF796b71A', 'evm', 'exploit', 'Wormhole Exploiter');
seed('0x9471772F7F808a5847d516592a9f5396c672d0CF', 'evm', 'exploit', 'Euler Finance Exploiter');
seed('0xc6a2Ad8cC6e4A7E08FC37cC5954be07d499E7654', 'evm', 'exploit', 'Ronin Bridge Hacker');
seed('0x098B716B8Aaf21512996dC57EB0615e2383E2f96', 'evm', 'known_hacker', 'Ronin Hacker (Lazarus Group)');
seed('0xA09871AEadF4994Ca12f5c0b6056BBd1d343c029', 'evm', 'known_hacker', 'Lazarus Group 1');
seed('0x1da5821544e25c636c1417Ba96Ade4Cf6D2f9B5A', 'evm', 'known_hacker', 'Lazarus Group 2');
seed('0x4976a4a02f38326660D17bf34b431dC6e2eb2327', 'evm', 'exploit', 'Nomad Bridge Exploiter');
seed('0xB1C72dba991f67B25d177bfe50e5Ed0abB805F97', 'evm', 'exploit', 'Beanstalk Exploiter');
seed('0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed', 'evm', 'exploit', 'Badger DAO Exploiter');
seed('0x905315602ED9A854e325F692Ff82F58799BEab57', 'evm', 'exploit', 'Poly Network Hacker');
seed('0x25c4a76E7B3497a3c13F108aE3e4135A0F292870', 'evm', 'exploit', 'Harmony Bridge Hacker');

// ── Famous Exploits — Solana (CertiK, Chainalysis) ──────────────────────────

seed('CfhUNRdYjEfTasMPR8GFkq47Gxd5Ycssic4SjfvLfMF7', 'solana', 'exploit', 'Wormhole Exploit (SOL)');
seed('4usz7iByGRvFt7MhJMSSGsAYUeXwMyMSMhxVU91vUaRx', 'solana', 'exploit', 'Mango Markets Exploiter');
seed('2yVjuQwpsvdsrywzsJJVs9Ueh4zc64J18aBc8sVEmums', 'solana', 'exploit', 'Cashio Exploiter');

// ── Solana Drainers / Rug Pullers (Mandiant, CertiK, Scam Sniffer) ──────────

seed('B8Y1dERnVNoUUXeXA4NaCHiB9htcukMSkfHrFsTMHA7h', 'solana', 'drainer', 'CLINKSINK DaaS Operator (Mandiant)');
seed('MszS2N8CT1MV9byX8FKFnrUpkmASSeR5Fmji19ushw1', 'solana', 'drainer', 'CLINKSINK Operator #2 (Mandiant)');
seed('9ZmcRsXnoqE47NfGxBrWKSXtpy8zzKR847BWz6EswEaU', 'solana', 'rug_pull', 'Xiaojiu Serial Rug Puller (CertiK, 64 rugs)');
seed('EZBbaxg7YqWo3XMAsTThZJEmTC9Dv78F5aB9srvsCtJg', 'solana', 'rug_pull', 'Xiaojiu Fund Flow E (CertiK)');
seed('D3s8Zf1zh8R98JBU9Fw4K8fViv1DDzCmoPbNTmJwXKbD', 'solana', 'rug_pull', 'Xiaojiu Fund Flow D3 (CertiK)');

// =============================================================================
// EXPORTS
// =============================================================================

export function isKnownScam(address: string): ScamEntry | null {
  return db.get(address.toLowerCase()) || null;
}

export function addScamEntry(
  address: string,
  chain: ChainType,
  type: ScamType,
  label: string,
  severity = 100,
): void {
  db.set(address.toLowerCase(), { address, chain, type, label, severity, addedAt: Date.now() });
}

export function getScamEntries(chain?: ChainType): ScamEntry[] {
  const all = Array.from(db.values());
  if (!chain) return all;
  return all.filter((e) => e.chain === chain);
}

export function getScamDbSize(): number {
  return db.size;
}
