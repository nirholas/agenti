// Chain configuration for 89+ supported chains
// Includes EVM, L2s, Alt L1s, and testnets

export interface ChainConfig {
  chainId: number;
  name: string;
  shortName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorers: { name: string; url: string }[];
  iconUrl: string;
  bridgeSupport: boolean;
  dexProtocols: string[];
  isTestnet?: boolean;
  isL2?: boolean;
  parentChainId?: number; // For L2s, the parent chain
}

// =============================================================================
// EVM MAINNETS
// =============================================================================

export const ethereum: ChainConfig = {
  chainId: 1,
  name: 'Ethereum',
  shortName: 'ETH',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://eth.llamarpc.com',
    'https://ethereum.publicnode.com',
    'https://rpc.ankr.com/eth',
  ],
  blockExplorers: [{ name: 'Etherscan', url: 'https://etherscan.io' }],
  iconUrl: '/chains/ethereum.svg',
  bridgeSupport: true,
  dexProtocols: ['uniswap-v3', 'uniswap-v2', 'sushiswap', 'curve', '1inch', '0x'],
};

export const polygon: ChainConfig = {
  chainId: 137,
  name: 'Polygon',
  shortName: 'MATIC',
  nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
  rpcUrls: [
    'https://polygon.llamarpc.com',
    'https://polygon-rpc.com',
    'https://rpc.ankr.com/polygon',
  ],
  blockExplorers: [{ name: 'PolygonScan', url: 'https://polygonscan.com' }],
  iconUrl: '/chains/polygon.svg',
  bridgeSupport: true,
  dexProtocols: ['quickswap', 'uniswap-v3', 'sushiswap', 'balancer', '1inch', '0x'],
};

export const arbitrum: ChainConfig = {
  chainId: 42161,
  name: 'Arbitrum One',
  shortName: 'ARB',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://arbitrum.llamarpc.com',
    'https://arb1.arbitrum.io/rpc',
    'https://rpc.ankr.com/arbitrum',
  ],
  blockExplorers: [{ name: 'Arbiscan', url: 'https://arbiscan.io' }],
  iconUrl: '/chains/arbitrum.svg',
  bridgeSupport: true,
  dexProtocols: ['uniswap-v3', 'sushiswap', 'camelot', 'gmx', '1inch', '0x'],
  isL2: true,
  parentChainId: 1,
};

export const optimism: ChainConfig = {
  chainId: 10,
  name: 'Optimism',
  shortName: 'OP',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://optimism.llamarpc.com',
    'https://mainnet.optimism.io',
    'https://rpc.ankr.com/optimism',
  ],
  blockExplorers: [{ name: 'Optimism Explorer', url: 'https://optimistic.etherscan.io' }],
  iconUrl: '/chains/optimism.svg',
  bridgeSupport: true,
  dexProtocols: ['uniswap-v3', 'velodrome', 'synthetix', '1inch', '0x'],
  isL2: true,
  parentChainId: 1,
};

export const base: ChainConfig = {
  chainId: 8453,
  name: 'Base',
  shortName: 'BASE',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://base.llamarpc.com',
    'https://mainnet.base.org',
    'https://rpc.ankr.com/base',
  ],
  blockExplorers: [{ name: 'BaseScan', url: 'https://basescan.org' }],
  iconUrl: '/chains/base.svg',
  bridgeSupport: true,
  dexProtocols: ['uniswap-v3', 'aerodrome', 'baseswap', '1inch', '0x'],
  isL2: true,
  parentChainId: 1,
};

export const bsc: ChainConfig = {
  chainId: 56,
  name: 'BNB Smart Chain',
  shortName: 'BSC',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: [
    'https://bsc.llamarpc.com',
    'https://bsc-dataseed.binance.org',
    'https://rpc.ankr.com/bsc',
  ],
  blockExplorers: [{ name: 'BscScan', url: 'https://bscscan.com' }],
  iconUrl: '/chains/bsc.svg',
  bridgeSupport: true,
  dexProtocols: ['pancakeswap', 'uniswap-v3', 'biswap', '1inch', '0x'],
};

export const avalanche: ChainConfig = {
  chainId: 43114,
  name: 'Avalanche C-Chain',
  shortName: 'AVAX',
  nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
  rpcUrls: [
    'https://avalanche.llamarpc.com',
    'https://api.avax.network/ext/bc/C/rpc',
    'https://rpc.ankr.com/avalanche',
  ],
  blockExplorers: [{ name: 'SnowTrace', url: 'https://snowtrace.io' }],
  iconUrl: '/chains/avalanche.svg',
  bridgeSupport: true,
  dexProtocols: ['trader-joe', 'pangolin', 'uniswap-v3', '1inch', '0x'],
};

export const fantom: ChainConfig = {
  chainId: 250,
  name: 'Fantom Opera',
  shortName: 'FTM',
  nativeCurrency: { name: 'Fantom', symbol: 'FTM', decimals: 18 },
  rpcUrls: [
    'https://rpc.ftm.tools',
    'https://fantom.publicnode.com',
    'https://rpc.ankr.com/fantom',
  ],
  blockExplorers: [{ name: 'FTMScan', url: 'https://ftmscan.com' }],
  iconUrl: '/chains/fantom.svg',
  bridgeSupport: true,
  dexProtocols: ['spookyswap', 'spiritswap', 'equalizer', '1inch'],
};

export const gnosis: ChainConfig = {
  chainId: 100,
  name: 'Gnosis Chain',
  shortName: 'GNO',
  nativeCurrency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 },
  rpcUrls: [
    'https://rpc.gnosischain.com',
    'https://gnosis.publicnode.com',
    'https://rpc.ankr.com/gnosis',
  ],
  blockExplorers: [{ name: 'GnosisScan', url: 'https://gnosisscan.io' }],
  iconUrl: '/chains/gnosis.svg',
  bridgeSupport: true,
  dexProtocols: ['honeyswap', 'sushiswap', 'curve', '1inch'],
};

export const celo: ChainConfig = {
  chainId: 42220,
  name: 'Celo',
  shortName: 'CELO',
  nativeCurrency: { name: 'Celo', symbol: 'CELO', decimals: 18 },
  rpcUrls: [
    'https://forno.celo.org',
    'https://rpc.ankr.com/celo',
  ],
  blockExplorers: [{ name: 'CeloScan', url: 'https://celoscan.io' }],
  iconUrl: '/chains/celo.svg',
  bridgeSupport: true,
  dexProtocols: ['ubeswap', 'curve', 'sushiswap'],
};

export const moonbeam: ChainConfig = {
  chainId: 1284,
  name: 'Moonbeam',
  shortName: 'GLMR',
  nativeCurrency: { name: 'Glimmer', symbol: 'GLMR', decimals: 18 },
  rpcUrls: [
    'https://rpc.api.moonbeam.network',
    'https://moonbeam.publicnode.com',
  ],
  blockExplorers: [{ name: 'Moonscan', url: 'https://moonbeam.moonscan.io' }],
  iconUrl: '/chains/moonbeam.svg',
  bridgeSupport: true,
  dexProtocols: ['stellaswap', 'beamswap', 'solarflare'],
};

export const moonriver: ChainConfig = {
  chainId: 1285,
  name: 'Moonriver',
  shortName: 'MOVR',
  nativeCurrency: { name: 'Moonriver', symbol: 'MOVR', decimals: 18 },
  rpcUrls: [
    'https://rpc.api.moonriver.moonbeam.network',
    'https://moonriver.publicnode.com',
  ],
  blockExplorers: [{ name: 'Moonscan', url: 'https://moonriver.moonscan.io' }],
  iconUrl: '/chains/moonriver.svg',
  bridgeSupport: true,
  dexProtocols: ['solarbeam', 'sushiswap'],
};

export const aurora: ChainConfig = {
  chainId: 1313161554,
  name: 'Aurora',
  shortName: 'AURORA',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://mainnet.aurora.dev',
    'https://aurora.drpc.org',
  ],
  blockExplorers: [{ name: 'Aurora Explorer', url: 'https://aurorascan.dev' }],
  iconUrl: '/chains/aurora.svg',
  bridgeSupport: true,
  dexProtocols: ['trisolaris', 'wannaswap', 'nearpad'],
};

export const cronos: ChainConfig = {
  chainId: 25,
  name: 'Cronos',
  shortName: 'CRO',
  nativeCurrency: { name: 'Cronos', symbol: 'CRO', decimals: 18 },
  rpcUrls: [
    'https://evm.cronos.org',
    'https://cronos.publicnode.com',
  ],
  blockExplorers: [{ name: 'CronosScan', url: 'https://cronoscan.com' }],
  iconUrl: '/chains/cronos.svg',
  bridgeSupport: true,
  dexProtocols: ['vvs-finance', 'mm-finance', 'cronaswap'],
};

export const harmonyOne: ChainConfig = {
  chainId: 1666600000,
  name: 'Harmony One',
  shortName: 'ONE',
  nativeCurrency: { name: 'ONE', symbol: 'ONE', decimals: 18 },
  rpcUrls: [
    'https://api.harmony.one',
    'https://harmony.publicnode.com',
  ],
  blockExplorers: [{ name: 'Harmony Explorer', url: 'https://explorer.harmony.one' }],
  iconUrl: '/chains/harmony.svg',
  bridgeSupport: true,
  dexProtocols: ['defikingdoms', 'sushiswap', 'viperswap'],
};

export const kava: ChainConfig = {
  chainId: 2222,
  name: 'Kava EVM',
  shortName: 'KAVA',
  nativeCurrency: { name: 'Kava', symbol: 'KAVA', decimals: 18 },
  rpcUrls: [
    'https://evm.kava.io',
    'https://kava.publicnode.com',
  ],
  blockExplorers: [{ name: 'Kava Explorer', url: 'https://explorer.kava.io' }],
  iconUrl: '/chains/kava.svg',
  bridgeSupport: true,
  dexProtocols: ['equilibre', 'mare-finance'],
};

export const metis: ChainConfig = {
  chainId: 1088,
  name: 'Metis Andromeda',
  shortName: 'METIS',
  nativeCurrency: { name: 'Metis', symbol: 'METIS', decimals: 18 },
  rpcUrls: [
    'https://andromeda.metis.io/?owner=1088',
    'https://metis.publicnode.com',
  ],
  blockExplorers: [{ name: 'Metis Explorer', url: 'https://andromeda-explorer.metis.io' }],
  iconUrl: '/chains/metis.svg',
  bridgeSupport: true,
  dexProtocols: ['netswap', 'hummus', 'hermes'],
  isL2: true,
  parentChainId: 1,
};

export const polygonZkEvm: ChainConfig = {
  chainId: 1101,
  name: 'Polygon zkEVM',
  shortName: 'zkEVM',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://zkevm-rpc.com',
    'https://polygon-zkevm.publicnode.com',
  ],
  blockExplorers: [{ name: 'PolygonScan', url: 'https://zkevm.polygonscan.com' }],
  iconUrl: '/chains/polygon-zkevm.svg',
  bridgeSupport: true,
  dexProtocols: ['quickswap', 'pancakeswap', 'uniswap-v3'],
  isL2: true,
  parentChainId: 1,
};

// =============================================================================
// L2s & ROLLUPS
// =============================================================================

export const zkSync: ChainConfig = {
  chainId: 324,
  name: 'zkSync Era',
  shortName: 'zkSync',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://mainnet.era.zksync.io',
    'https://zksync.publicnode.com',
  ],
  blockExplorers: [{ name: 'zkSync Explorer', url: 'https://explorer.zksync.io' }],
  iconUrl: '/chains/zksync.svg',
  bridgeSupport: true,
  dexProtocols: ['syncswap', 'mute', 'spacefi', 'velocore'],
  isL2: true,
  parentChainId: 1,
};

export const linea: ChainConfig = {
  chainId: 59144,
  name: 'Linea',
  shortName: 'LINEA',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://rpc.linea.build',
    'https://linea.publicnode.com',
  ],
  blockExplorers: [{ name: 'LineaScan', url: 'https://lineascan.build' }],
  iconUrl: '/chains/linea.svg',
  bridgeSupport: true,
  dexProtocols: ['syncswap', 'horizondex', 'velocore'],
  isL2: true,
  parentChainId: 1,
};

export const scroll: ChainConfig = {
  chainId: 534352,
  name: 'Scroll',
  shortName: 'SCROLL',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://rpc.scroll.io',
    'https://scroll.publicnode.com',
  ],
  blockExplorers: [{ name: 'Scrollscan', url: 'https://scrollscan.com' }],
  iconUrl: '/chains/scroll.svg',
  bridgeSupport: true,
  dexProtocols: ['syncswap', 'skydrome', 'zebra'],
  isL2: true,
  parentChainId: 1,
};

export const mantle: ChainConfig = {
  chainId: 5000,
  name: 'Mantle',
  shortName: 'MNT',
  nativeCurrency: { name: 'Mantle', symbol: 'MNT', decimals: 18 },
  rpcUrls: [
    'https://rpc.mantle.xyz',
    'https://mantle.publicnode.com',
  ],
  blockExplorers: [{ name: 'Mantle Explorer', url: 'https://explorer.mantle.xyz' }],
  iconUrl: '/chains/mantle.svg',
  bridgeSupport: true,
  dexProtocols: ['fusionx', 'agni', 'cleopatra'],
  isL2: true,
  parentChainId: 1,
};

export const blast: ChainConfig = {
  chainId: 81457,
  name: 'Blast',
  shortName: 'BLAST',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://rpc.blast.io',
    'https://blast.publicnode.com',
  ],
  blockExplorers: [{ name: 'BlastScan', url: 'https://blastscan.io' }],
  iconUrl: '/chains/blast.svg',
  bridgeSupport: true,
  dexProtocols: ['thruster', 'hyperlock', 'blasterswap'],
  isL2: true,
  parentChainId: 1,
};

export const mode: ChainConfig = {
  chainId: 34443,
  name: 'Mode',
  shortName: 'MODE',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://mainnet.mode.network',
    'https://mode.publicnode.com',
  ],
  blockExplorers: [{ name: 'Mode Explorer', url: 'https://explorer.mode.network' }],
  iconUrl: '/chains/mode.svg',
  bridgeSupport: true,
  dexProtocols: ['kim', 'supswap', 'swapmode'],
  isL2: true,
  parentChainId: 1,
};

export const manta: ChainConfig = {
  chainId: 169,
  name: 'Manta Pacific',
  shortName: 'MANTA',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://pacific-rpc.manta.network/http',
    'https://manta-pacific.publicnode.com',
  ],
  blockExplorers: [{ name: 'Manta Explorer', url: 'https://pacific-explorer.manta.network' }],
  iconUrl: '/chains/manta.svg',
  bridgeSupport: true,
  dexProtocols: ['quickswap', 'aperture'],
  isL2: true,
  parentChainId: 1,
};

export const zora: ChainConfig = {
  chainId: 7777777,
  name: 'Zora',
  shortName: 'ZORA',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://rpc.zora.energy',
  ],
  blockExplorers: [{ name: 'Zora Explorer', url: 'https://explorer.zora.energy' }],
  iconUrl: '/chains/zora.svg',
  bridgeSupport: true,
  dexProtocols: ['uniswap-v3'],
  isL2: true,
  parentChainId: 1,
};

export const arbitrumNova: ChainConfig = {
  chainId: 42170,
  name: 'Arbitrum Nova',
  shortName: 'NOVA',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://nova.arbitrum.io/rpc',
    'https://arbitrum-nova.publicnode.com',
  ],
  blockExplorers: [{ name: 'Nova Explorer', url: 'https://nova.arbiscan.io' }],
  iconUrl: '/chains/arbitrum-nova.svg',
  bridgeSupport: true,
  dexProtocols: ['sushiswap', 'rcpswap'],
  isL2: true,
  parentChainId: 1,
};

export const opBNB: ChainConfig = {
  chainId: 204,
  name: 'opBNB',
  shortName: 'opBNB',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: [
    'https://opbnb-mainnet-rpc.bnbchain.org',
    'https://opbnb.publicnode.com',
  ],
  blockExplorers: [{ name: 'opBNB Explorer', url: 'https://opbnbscan.com' }],
  iconUrl: '/chains/opbnb.svg',
  bridgeSupport: true,
  dexProtocols: ['pancakeswap'],
  isL2: true,
  parentChainId: 56,
};

export const fraxtal: ChainConfig = {
  chainId: 252,
  name: 'Fraxtal',
  shortName: 'FRAX',
  nativeCurrency: { name: 'Frax Ether', symbol: 'frxETH', decimals: 18 },
  rpcUrls: [
    'https://rpc.frax.com',
  ],
  blockExplorers: [{ name: 'Fraxscan', url: 'https://fraxscan.com' }],
  iconUrl: '/chains/fraxtal.svg',
  bridgeSupport: true,
  dexProtocols: ['fraxswap', 'ra'],
  isL2: true,
  parentChainId: 1,
};

export const worldChain: ChainConfig = {
  chainId: 480,
  name: 'World Chain',
  shortName: 'WLD',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://worldchain-mainnet.g.alchemy.com/public',
  ],
  blockExplorers: [{ name: 'World Explorer', url: 'https://worldscan.org' }],
  iconUrl: '/chains/worldchain.svg',
  bridgeSupport: true,
  dexProtocols: ['uniswap-v3'],
  isL2: true,
  parentChainId: 1,
};

export const taiko: ChainConfig = {
  chainId: 167000,
  name: 'Taiko',
  shortName: 'TAIKO',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://rpc.mainnet.taiko.xyz',
  ],
  blockExplorers: [{ name: 'Taiko Explorer', url: 'https://taikoscan.io' }],
  iconUrl: '/chains/taiko.svg',
  bridgeSupport: true,
  dexProtocols: ['henjin', 'panko'],
  isL2: true,
  parentChainId: 1,
};

export const bob: ChainConfig = {
  chainId: 60808,
  name: 'BOB',
  shortName: 'BOB',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://rpc.gobob.xyz',
  ],
  blockExplorers: [{ name: 'BOB Explorer', url: 'https://explorer.gobob.xyz' }],
  iconUrl: '/chains/bob.svg',
  bridgeSupport: true,
  dexProtocols: ['oku', 'ambient'],
  isL2: true,
  parentChainId: 1,
};

export const cyber: ChainConfig = {
  chainId: 7560,
  name: 'Cyber',
  shortName: 'CYBER',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://cyber.alt.technology',
  ],
  blockExplorers: [{ name: 'Cyber Explorer', url: 'https://cyberscan.co' }],
  iconUrl: '/chains/cyber.svg',
  bridgeSupport: true,
  dexProtocols: ['velodrome'],
  isL2: true,
  parentChainId: 1,
};

export const redstone: ChainConfig = {
  chainId: 690,
  name: 'Redstone',
  shortName: 'RED',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://rpc.redstonechain.com',
  ],
  blockExplorers: [{ name: 'Redstone Explorer', url: 'https://explorer.redstone.xyz' }],
  iconUrl: '/chains/redstone.svg',
  bridgeSupport: true,
  dexProtocols: [],
  isL2: true,
  parentChainId: 1,
};

export const sei: ChainConfig = {
  chainId: 1329,
  name: 'Sei',
  shortName: 'SEI',
  nativeCurrency: { name: 'Sei', symbol: 'SEI', decimals: 18 },
  rpcUrls: [
    'https://evm-rpc.sei-apis.com',
  ],
  blockExplorers: [{ name: 'Sei Explorer', url: 'https://seitrace.com' }],
  iconUrl: '/chains/sei.svg',
  bridgeSupport: true,
  dexProtocols: ['dragonswap', 'yaka'],
};

export const immutableZkEvm: ChainConfig = {
  chainId: 13371,
  name: 'Immutable zkEVM',
  shortName: 'IMX',
  nativeCurrency: { name: 'IMX', symbol: 'IMX', decimals: 18 },
  rpcUrls: [
    'https://rpc.immutable.com',
  ],
  blockExplorers: [{ name: 'Immutable Explorer', url: 'https://explorer.immutable.com' }],
  iconUrl: '/chains/immutable.svg',
  bridgeSupport: true,
  dexProtocols: ['quickswap'],
  isL2: true,
  parentChainId: 1,
};

export const lisk: ChainConfig = {
  chainId: 1135,
  name: 'Lisk',
  shortName: 'LSK',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://rpc.api.lisk.com',
  ],
  blockExplorers: [{ name: 'Lisk Explorer', url: 'https://blockscout.lisk.com' }],
  iconUrl: '/chains/lisk.svg',
  bridgeSupport: true,
  dexProtocols: ['velodrome'],
  isL2: true,
  parentChainId: 1,
};

export const ink: ChainConfig = {
  chainId: 57073,
  name: 'Ink',
  shortName: 'INK',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://rpc-gel.inkonchain.com',
  ],
  blockExplorers: [{ name: 'Ink Explorer', url: 'https://explorer.inkonchain.com' }],
  iconUrl: '/chains/ink.svg',
  bridgeSupport: true,
  dexProtocols: ['velodrome'],
  isL2: true,
  parentChainId: 1,
};

export const soneium: ChainConfig = {
  chainId: 1868,
  name: 'Soneium',
  shortName: 'SONE',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://rpc.soneium.org',
  ],
  blockExplorers: [{ name: 'Soneium Explorer', url: 'https://soneium.blockscout.com' }],
  iconUrl: '/chains/soneium.svg',
  bridgeSupport: true,
  dexProtocols: ['velodrome'],
  isL2: true,
  parentChainId: 1,
};

export const abstract: ChainConfig = {
  chainId: 2741,
  name: 'Abstract',
  shortName: 'ABS',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://api.mainnet.abs.xyz',
  ],
  blockExplorers: [{ name: 'Abstract Explorer', url: 'https://abscan.org' }],
  iconUrl: '/chains/abstract.svg',
  bridgeSupport: true,
  dexProtocols: ['syncswap'],
  isL2: true,
  parentChainId: 1,
};

export const unichain: ChainConfig = {
  chainId: 130,
  name: 'Unichain',
  shortName: 'UNI',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://mainnet.unichain.org',
  ],
  blockExplorers: [{ name: 'Unichain Explorer', url: 'https://uniscan.xyz' }],
  iconUrl: '/chains/unichain.svg',
  bridgeSupport: true,
  dexProtocols: ['uniswap-v4'],
  isL2: true,
  parentChainId: 1,
};

export const apeChain: ChainConfig = {
  chainId: 33139,
  name: 'ApeChain',
  shortName: 'APE',
  nativeCurrency: { name: 'ApeCoin', symbol: 'APE', decimals: 18 },
  rpcUrls: [
    'https://rpc.apechain.com/http',
  ],
  blockExplorers: [{ name: 'ApeChain Explorer', url: 'https://apescan.io' }],
  iconUrl: '/chains/apechain.svg',
  bridgeSupport: true,
  dexProtocols: ['camelot'],
  isL2: true,
  parentChainId: 42161,
};

export const berachain: ChainConfig = {
  chainId: 80094,
  name: 'Berachain',
  shortName: 'BERA',
  nativeCurrency: { name: 'BERA', symbol: 'BERA', decimals: 18 },
  rpcUrls: [
    'https://rpc.berachain.com',
  ],
  blockExplorers: [{ name: 'Berachain Explorer', url: 'https://berascan.com' }],
  iconUrl: '/chains/berachain.svg',
  bridgeSupport: true,
  dexProtocols: ['kodiak', 'bex'],
};

export const sonic: ChainConfig = {
  chainId: 146,
  name: 'Sonic',
  shortName: 'S',
  nativeCurrency: { name: 'Sonic', symbol: 'S', decimals: 18 },
  rpcUrls: [
    'https://rpc.soniclabs.com',
  ],
  blockExplorers: [{ name: 'Sonic Explorer', url: 'https://sonicscan.org' }],
  iconUrl: '/chains/sonic.svg',
  bridgeSupport: true,
  dexProtocols: ['shadow', 'swapx'],
};

// =============================================================================
// ALT L1s (Non-EVM compatible - need special handling)
// =============================================================================

export const solana: ChainConfig = {
  chainId: -1, // Non-EVM, use custom identifier
  name: 'Solana',
  shortName: 'SOL',
  nativeCurrency: { name: 'Solana', symbol: 'SOL', decimals: 9 },
  rpcUrls: [
    'https://api.mainnet-beta.solana.com',
    'https://solana-mainnet.g.alchemy.com/v2/',
  ],
  blockExplorers: [{ name: 'Solscan', url: 'https://solscan.io' }],
  iconUrl: '/chains/solana.svg',
  bridgeSupport: true,
  dexProtocols: ['jupiter', 'raydium', 'orca'],
};

export const sui: ChainConfig = {
  chainId: -2, // Non-EVM
  name: 'Sui',
  shortName: 'SUI',
  nativeCurrency: { name: 'Sui', symbol: 'SUI', decimals: 9 },
  rpcUrls: [
    'https://fullnode.mainnet.sui.io:443',
  ],
  blockExplorers: [{ name: 'Sui Explorer', url: 'https://suiscan.xyz' }],
  iconUrl: '/chains/sui.svg',
  bridgeSupport: true,
  dexProtocols: ['cetus', 'turbos', 'aftermath'],
};

export const aptos: ChainConfig = {
  chainId: -3, // Non-EVM
  name: 'Aptos',
  shortName: 'APT',
  nativeCurrency: { name: 'Aptos', symbol: 'APT', decimals: 8 },
  rpcUrls: [
    'https://fullnode.mainnet.aptoslabs.com/v1',
  ],
  blockExplorers: [{ name: 'Aptos Explorer', url: 'https://aptoscan.com' }],
  iconUrl: '/chains/aptos.svg',
  bridgeSupport: true,
  dexProtocols: ['pancakeswap', 'liquidswap', 'thala'],
};

export const near: ChainConfig = {
  chainId: -4, // Non-EVM
  name: 'NEAR Protocol',
  shortName: 'NEAR',
  nativeCurrency: { name: 'NEAR', symbol: 'NEAR', decimals: 24 },
  rpcUrls: [
    'https://rpc.mainnet.near.org',
  ],
  blockExplorers: [{ name: 'NEAR Explorer', url: 'https://nearblocks.io' }],
  iconUrl: '/chains/near.svg',
  bridgeSupport: true,
  dexProtocols: ['ref-finance', 'jumbo'],
};

export const ton: ChainConfig = {
  chainId: -5, // Non-EVM
  name: 'TON',
  shortName: 'TON',
  nativeCurrency: { name: 'Toncoin', symbol: 'TON', decimals: 9 },
  rpcUrls: [
    'https://toncenter.com/api/v2/jsonRPC',
  ],
  blockExplorers: [{ name: 'TON Explorer', url: 'https://tonscan.org' }],
  iconUrl: '/chains/ton.svg',
  bridgeSupport: true,
  dexProtocols: ['stonfi', 'dedust'],
};

export const tron: ChainConfig = {
  chainId: -6, // Non-EVM
  name: 'TRON',
  shortName: 'TRX',
  nativeCurrency: { name: 'TRON', symbol: 'TRX', decimals: 6 },
  rpcUrls: [
    'https://api.trongrid.io',
  ],
  blockExplorers: [{ name: 'TronScan', url: 'https://tronscan.org' }],
  iconUrl: '/chains/tron.svg',
  bridgeSupport: true,
  dexProtocols: ['sunswap', 'justswap'],
};

export const injective: ChainConfig = {
  chainId: -7, // Non-EVM (Cosmos-based)
  name: 'Injective',
  shortName: 'INJ',
  nativeCurrency: { name: 'Injective', symbol: 'INJ', decimals: 18 },
  rpcUrls: [
    'https://sentry.lcd.injective.network',
  ],
  blockExplorers: [{ name: 'Injective Explorer', url: 'https://explorer.injective.network' }],
  iconUrl: '/chains/injective.svg',
  bridgeSupport: true,
  dexProtocols: ['helix', 'astroport'],
};

export const cosmosHub: ChainConfig = {
  chainId: -8, // Non-EVM (Cosmos)
  name: 'Cosmos Hub',
  shortName: 'ATOM',
  nativeCurrency: { name: 'Cosmos', symbol: 'ATOM', decimals: 6 },
  rpcUrls: [
    'https://cosmos-rpc.polkachu.com',
  ],
  blockExplorers: [{ name: 'Mintscan', url: 'https://www.mintscan.io/cosmos' }],
  iconUrl: '/chains/cosmos.svg',
  bridgeSupport: true,
  dexProtocols: ['osmosis'],
};

export const osmosis: ChainConfig = {
  chainId: -9, // Non-EVM (Cosmos)
  name: 'Osmosis',
  shortName: 'OSMO',
  nativeCurrency: { name: 'Osmosis', symbol: 'OSMO', decimals: 6 },
  rpcUrls: [
    'https://rpc.osmosis.zone',
  ],
  blockExplorers: [{ name: 'Mintscan', url: 'https://www.mintscan.io/osmosis' }],
  iconUrl: '/chains/osmosis.svg',
  bridgeSupport: true,
  dexProtocols: ['osmosis'],
};

export const celestia: ChainConfig = {
  chainId: -10, // Non-EVM (Cosmos)
  name: 'Celestia',
  shortName: 'TIA',
  nativeCurrency: { name: 'Celestia', symbol: 'TIA', decimals: 6 },
  rpcUrls: [
    'https://rpc.celestia.pops.one',
  ],
  blockExplorers: [{ name: 'Celenium', url: 'https://celenium.io' }],
  iconUrl: '/chains/celestia.svg',
  bridgeSupport: true,
  dexProtocols: [],
};

export const starknet: ChainConfig = {
  chainId: -11, // Non-EVM
  name: 'Starknet',
  shortName: 'STRK',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://starknet-mainnet.public.blastapi.io',
  ],
  blockExplorers: [{ name: 'Starkscan', url: 'https://starkscan.co' }],
  iconUrl: '/chains/starknet.svg',
  bridgeSupport: true,
  dexProtocols: ['jediswap', '10kswap', 'myswap'],
};

export const bitcoin: ChainConfig = {
  chainId: -12, // Non-EVM
  name: 'Bitcoin',
  shortName: 'BTC',
  nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 8 },
  rpcUrls: [],
  blockExplorers: [{ name: 'Blockstream', url: 'https://blockstream.info' }],
  iconUrl: '/chains/bitcoin.svg',
  bridgeSupport: true,
  dexProtocols: [],
};

// =============================================================================
// TESTNETS (Dev Mode)
// =============================================================================

export const sepolia: ChainConfig = {
  chainId: 11155111,
  name: 'Sepolia',
  shortName: 'SEP',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://rpc.sepolia.org',
    'https://ethereum-sepolia.publicnode.com',
  ],
  blockExplorers: [{ name: 'Etherscan', url: 'https://sepolia.etherscan.io' }],
  iconUrl: '/chains/ethereum.svg',
  bridgeSupport: false,
  dexProtocols: ['uniswap-v3'],
  isTestnet: true,
};

export const holeskyTestnet: ChainConfig = {
  chainId: 17000,
  name: 'Holesky',
  shortName: 'HOLESKY',
  nativeCurrency: { name: 'Holesky Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://ethereum-holesky.publicnode.com',
  ],
  blockExplorers: [{ name: 'Etherscan', url: 'https://holesky.etherscan.io' }],
  iconUrl: '/chains/ethereum.svg',
  bridgeSupport: false,
  dexProtocols: [],
  isTestnet: true,
};

export const polygonAmoy: ChainConfig = {
  chainId: 80002,
  name: 'Polygon Amoy',
  shortName: 'AMOY',
  nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
  rpcUrls: [
    'https://rpc-amoy.polygon.technology',
  ],
  blockExplorers: [{ name: 'PolygonScan', url: 'https://amoy.polygonscan.com' }],
  iconUrl: '/chains/polygon.svg',
  bridgeSupport: false,
  dexProtocols: [],
  isTestnet: true,
};

export const arbitrumSepolia: ChainConfig = {
  chainId: 421614,
  name: 'Arbitrum Sepolia',
  shortName: 'ARB-SEP',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://sepolia-rollup.arbitrum.io/rpc',
  ],
  blockExplorers: [{ name: 'Arbiscan', url: 'https://sepolia.arbiscan.io' }],
  iconUrl: '/chains/arbitrum.svg',
  bridgeSupport: false,
  dexProtocols: [],
  isTestnet: true,
};

export const optimismSepolia: ChainConfig = {
  chainId: 11155420,
  name: 'Optimism Sepolia',
  shortName: 'OP-SEP',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://sepolia.optimism.io',
  ],
  blockExplorers: [{ name: 'Etherscan', url: 'https://sepolia-optimism.etherscan.io' }],
  iconUrl: '/chains/optimism.svg',
  bridgeSupport: false,
  dexProtocols: [],
  isTestnet: true,
};

export const baseSepolia: ChainConfig = {
  chainId: 84532,
  name: 'Base Sepolia',
  shortName: 'BASE-SEP',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://sepolia.base.org',
  ],
  blockExplorers: [{ name: 'BaseScan', url: 'https://sepolia.basescan.org' }],
  iconUrl: '/chains/base.svg',
  bridgeSupport: false,
  dexProtocols: [],
  isTestnet: true,
};

export const bscTestnet: ChainConfig = {
  chainId: 97,
  name: 'BSC Testnet',
  shortName: 'BSC-TEST',
  nativeCurrency: { name: 'BNB', symbol: 'tBNB', decimals: 18 },
  rpcUrls: [
    'https://data-seed-prebsc-1-s1.binance.org:8545',
  ],
  blockExplorers: [{ name: 'BscScan', url: 'https://testnet.bscscan.com' }],
  iconUrl: '/chains/bsc.svg',
  bridgeSupport: false,
  dexProtocols: [],
  isTestnet: true,
};

export const avalancheFuji: ChainConfig = {
  chainId: 43113,
  name: 'Avalanche Fuji',
  shortName: 'FUJI',
  nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
  rpcUrls: [
    'https://api.avax-test.network/ext/bc/C/rpc',
  ],
  blockExplorers: [{ name: 'SnowTrace', url: 'https://testnet.snowtrace.io' }],
  iconUrl: '/chains/avalanche.svg',
  bridgeSupport: false,
  dexProtocols: [],
  isTestnet: true,
};

export const zkSyncSepolia: ChainConfig = {
  chainId: 300,
  name: 'zkSync Sepolia',
  shortName: 'zkSync-SEP',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://sepolia.era.zksync.dev',
  ],
  blockExplorers: [{ name: 'zkSync Explorer', url: 'https://sepolia.explorer.zksync.io' }],
  iconUrl: '/chains/zksync.svg',
  bridgeSupport: false,
  dexProtocols: [],
  isTestnet: true,
};

export const lineaSepolia: ChainConfig = {
  chainId: 59141,
  name: 'Linea Sepolia',
  shortName: 'LINEA-SEP',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://rpc.sepolia.linea.build',
  ],
  blockExplorers: [{ name: 'LineaScan', url: 'https://sepolia.lineascan.build' }],
  iconUrl: '/chains/linea.svg',
  bridgeSupport: false,
  dexProtocols: [],
  isTestnet: true,
};

export const scrollSepolia: ChainConfig = {
  chainId: 534351,
  name: 'Scroll Sepolia',
  shortName: 'SCROLL-SEP',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://sepolia-rpc.scroll.io',
  ],
  blockExplorers: [{ name: 'Scrollscan', url: 'https://sepolia.scrollscan.com' }],
  iconUrl: '/chains/scroll.svg',
  bridgeSupport: false,
  dexProtocols: [],
  isTestnet: true,
};

export const blastSepolia: ChainConfig = {
  chainId: 168587773,
  name: 'Blast Sepolia',
  shortName: 'BLAST-SEP',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [
    'https://sepolia.blast.io',
  ],
  blockExplorers: [{ name: 'BlastScan', url: 'https://sepolia.blastscan.io' }],
  iconUrl: '/chains/blast.svg',
  bridgeSupport: false,
  dexProtocols: [],
  isTestnet: true,
};

// =============================================================================
// CHAIN COLLECTIONS
// =============================================================================

// All EVM mainnet chains
export const evmMainnets: ChainConfig[] = [
  ethereum,
  polygon,
  arbitrum,
  optimism,
  base,
  bsc,
  avalanche,
  fantom,
  gnosis,
  celo,
  moonbeam,
  moonriver,
  aurora,
  cronos,
  harmonyOne,
  kava,
  metis,
  polygonZkEvm,
];

// All L2 chains
export const l2Chains: ChainConfig[] = [
  arbitrum,
  optimism,
  base,
  zkSync,
  linea,
  scroll,
  mantle,
  blast,
  mode,
  manta,
  zora,
  arbitrumNova,
  opBNB,
  fraxtal,
  worldChain,
  taiko,
  bob,
  cyber,
  redstone,
  immutableZkEvm,
  lisk,
  ink,
  soneium,
  abstract,
  unichain,
  apeChain,
  metis,
  polygonZkEvm,
];

// All alternative L1 chains (non-EVM)
export const altL1Chains: ChainConfig[] = [
  solana,
  sui,
  aptos,
  near,
  ton,
  tron,
  injective,
  cosmosHub,
  osmosis,
  celestia,
  starknet,
  bitcoin,
];

// New and trending chains
export const trendingChains: ChainConfig[] = [
  base,
  blast,
  berachain,
  sonic,
  abstract,
  unichain,
  worldChain,
  ink,
  soneium,
  apeChain,
];

// All testnet chains
export const testnets: ChainConfig[] = [
  sepolia,
  holeskyTestnet,
  polygonAmoy,
  arbitrumSepolia,
  optimismSepolia,
  baseSepolia,
  bscTestnet,
  avalancheFuji,
  zkSyncSepolia,
  lineaSepolia,
  scrollSepolia,
  blastSepolia,
];

// All supported chains
export const allChains: ChainConfig[] = [
  // EVM Mainnets
  ethereum,
  polygon,
  arbitrum,
  optimism,
  base,
  bsc,
  avalanche,
  fantom,
  gnosis,
  celo,
  moonbeam,
  moonriver,
  aurora,
  cronos,
  harmonyOne,
  kava,
  metis,
  polygonZkEvm,
  // L2s
  zkSync,
  linea,
  scroll,
  mantle,
  blast,
  mode,
  manta,
  zora,
  arbitrumNova,
  opBNB,
  fraxtal,
  worldChain,
  taiko,
  bob,
  cyber,
  redstone,
  sei,
  immutableZkEvm,
  lisk,
  ink,
  soneium,
  abstract,
  unichain,
  apeChain,
  berachain,
  sonic,
  // Alt L1s
  solana,
  sui,
  aptos,
  near,
  ton,
  tron,
  injective,
  cosmosHub,
  osmosis,
  celestia,
  starknet,
  bitcoin,
  // Testnets
  sepolia,
  holeskyTestnet,
  polygonAmoy,
  arbitrumSepolia,
  optimismSepolia,
  baseSepolia,
  bscTestnet,
  avalancheFuji,
  zkSyncSepolia,
  lineaSepolia,
  scrollSepolia,
  blastSepolia,
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Chain lookup by ID
export const chainById = new Map<number, ChainConfig>(
  allChains.map((chain) => [chain.chainId, chain])
);

// Chain lookup by short name
export const chainByShortName = new Map<string, ChainConfig>(
  allChains.map((chain) => [chain.shortName.toLowerCase(), chain])
);

/**
 * Get chain config by chain ID
 */
export function getChain(chainId: number): ChainConfig | undefined {
  return chainById.get(chainId);
}

/**
 * Get chain config by short name
 */
export function getChainByName(shortName: string): ChainConfig | undefined {
  return chainByShortName.get(shortName.toLowerCase());
}

/**
 * Check if a chain is an EVM chain
 */
export function isEvmChain(chainId: number): boolean {
  return chainId > 0;
}

/**
 * Check if a chain is a testnet
 */
export function isTestnet(chainId: number): boolean {
  const chain = getChain(chainId);
  return chain?.isTestnet ?? false;
}

/**
 * Check if a chain is an L2
 */
export function isL2(chainId: number): boolean {
  const chain = getChain(chainId);
  return chain?.isL2 ?? false;
}

/**
 * Get all chains that support a specific DEX protocol
 */
export function getChainsByDex(protocol: string): ChainConfig[] {
  return allChains.filter((chain) =>
    chain.dexProtocols.includes(protocol.toLowerCase())
  );
}

/**
 * Get all mainnet chains (exclude testnets)
 */
export function getMainnets(): ChainConfig[] {
  return allChains.filter((chain) => !chain.isTestnet);
}

/**
 * Get popular/recommended chains for quick selection
 */
export function getPopularChains(): ChainConfig[] {
  const popularIds = [1, 137, 42161, 10, 8453, 56, 43114, 324, 59144, 534352];
  return popularIds
    .map((id) => getChain(id))
    .filter((chain): chain is ChainConfig => chain !== undefined);
}

/**
 * Get the RPC URL for a chain (with fallback)
 */
export function getRpcUrl(chainId: number, index = 0): string | undefined {
  const chain = getChain(chainId);
  return chain?.rpcUrls[index] ?? chain?.rpcUrls[0];
}

/**
 * Get the block explorer URL for a chain
 */
export function getExplorerUrl(chainId: number): string | undefined {
  const chain = getChain(chainId);
  return chain?.blockExplorers[0]?.url;
}

/**
 * Get transaction URL on block explorer
 */
export function getTxUrl(chainId: number, txHash: string): string | undefined {
  const explorerUrl = getExplorerUrl(chainId);
  if (!explorerUrl) return undefined;
  return `${explorerUrl}/tx/${txHash}`;
}

/**
 * Get address URL on block explorer
 */
export function getAddressUrl(chainId: number, address: string): string | undefined {
  const explorerUrl = getExplorerUrl(chainId);
  if (!explorerUrl) return undefined;
  return `${explorerUrl}/address/${address}`;
}

// Type for supported chain IDs (EVM only)
export type SupportedChainId = typeof allChains[number]['chainId'];

// Default chain for the app
export const DEFAULT_CHAIN_ID = 8453; // Base

// Export chain count for reference
export const TOTAL_SUPPORTED_CHAINS = allChains.length;
