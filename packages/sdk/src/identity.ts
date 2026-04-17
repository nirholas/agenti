/**
 * ERC-8004 Agent Identity Module
 *
 * Register AI agents as on-chain ERC-8004 identities (ERC-721 NFTs) and
 * look them up across 22 EVM chains.
 *
 * Contract: IdentityRegistry at 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
 * Spec:     https://eips.ethereum.org/EIPS/eip-8004
 */

import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  publicActions,
  type Address,
  type Chain as ViemChain,
  type Hex,
} from 'viem'
import {
  mainnet,
  base,
  arbitrum,
  polygon,
  optimism,
  bsc,
  avalanche,
  sepolia,
  baseSepolia,
  arbitrumSepolia,
  optimismSepolia,
  polygonAmoy,
  scroll,
  gnosis,
  celo,
  fantom,
  mantle,
  zkSync,
  linea,
  moonbeam,
  bscTestnet,
} from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

// ─── Contract ABI (extracted from nirholas/erc8004-agents) ──────────────────
// Source: agent-runtime/src/utils/contracts.ts and mcp-server/src/contracts.ts

const IDENTITY_ABI = [
  // Registration
  {
    name: 'register',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    name: 'register',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    name: 'register',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentURI', type: 'string' },
      {
        name: 'metadata',
        type: 'tuple[]',
        components: [
          { name: 'metadataKey', type: 'string' },
          { name: 'metadataValue', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  // URI management
  {
    name: 'setAgentURI',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'newURI', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'tokenURI',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'string' }],
  },
  // Metadata
  {
    name: 'setMetadata',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'metadataKey', type: 'string' },
      { name: 'metadataValue', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'getMetadata',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'metadataKey', type: 'string' },
    ],
    outputs: [{ type: 'bytes' }],
  },
  // Ownership
  {
    name: 'getAgentWallet',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  // Info
  {
    name: 'getVersion',
    type: 'function',
    stateMutability: 'pure',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  // Events
  {
    name: 'Registered',
    type: 'event',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'agentURI', type: 'string', indexed: false },
      { name: 'owner', type: 'address', indexed: true },
    ],
  },
  {
    name: 'Transfer',
    type: 'event',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true },
    ],
  },
] as const

// ─── Contract Addresses (from nirholas/erc8004-agents) ──────────────────────
// Mainnet: separate deployment, 0x8004 vanity prefix
// Testnet: deterministic CREATE2, same address on all testnets

const MAINNET_IDENTITY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as const
const TESTNET_IDENTITY = '0x8004A818BFB912233c491871b3d84c89A494BD9e' as const

// ─── Chain Configuration (22 EVM chains from index.html) ────────────────────

type ChainKey = 'ethereum' | 'base' | 'arbitrum' | 'polygon'

interface ChainEntry {
  viemChain: ViemChain
  contractAddress: Address
  explorer: string
}

const CHAIN_MAP: Record<string, ChainEntry> = {
  // Mainnets
  ethereum: {
    viemChain: mainnet,
    contractAddress: MAINNET_IDENTITY,
    explorer: 'https://etherscan.io',
  },
  base: {
    viemChain: base,
    contractAddress: MAINNET_IDENTITY,
    explorer: 'https://basescan.org',
  },
  arbitrum: {
    viemChain: arbitrum,
    contractAddress: MAINNET_IDENTITY,
    explorer: 'https://arbiscan.io',
  },
  polygon: {
    viemChain: polygon,
    contractAddress: MAINNET_IDENTITY,
    explorer: 'https://polygonscan.com',
  },
  optimism: {
    viemChain: optimism,
    contractAddress: MAINNET_IDENTITY,
    explorer: 'https://optimistic.etherscan.io',
  },
  bsc: {
    viemChain: bsc,
    contractAddress: MAINNET_IDENTITY,
    explorer: 'https://bscscan.com',
  },
  avalanche: {
    viemChain: avalanche,
    contractAddress: MAINNET_IDENTITY,
    explorer: 'https://snowtrace.io',
  },
  linea: {
    viemChain: linea,
    contractAddress: MAINNET_IDENTITY,
    explorer: 'https://lineascan.build',
  },
  scroll: {
    viemChain: scroll,
    contractAddress: MAINNET_IDENTITY,
    explorer: 'https://scrollscan.com',
  },
  zksync: {
    viemChain: zkSync,
    contractAddress: MAINNET_IDENTITY,
    explorer: 'https://explorer.zksync.io',
  },
  mantle: {
    viemChain: mantle,
    contractAddress: MAINNET_IDENTITY,
    explorer: 'https://explorer.mantle.xyz',
  },
  fantom: {
    viemChain: fantom,
    contractAddress: MAINNET_IDENTITY,
    explorer: 'https://ftmscan.com',
  },
  gnosis: {
    viemChain: gnosis,
    contractAddress: MAINNET_IDENTITY,
    explorer: 'https://gnosisscan.io',
  },
  celo: {
    viemChain: celo,
    contractAddress: MAINNET_IDENTITY,
    explorer: 'https://celoscan.io',
  },
  moonbeam: {
    viemChain: moonbeam,
    contractAddress: MAINNET_IDENTITY,
    explorer: 'https://moonbeam.moonscan.io',
  },
  // Testnets
  sepolia: {
    viemChain: sepolia,
    contractAddress: TESTNET_IDENTITY,
    explorer: 'https://sepolia.etherscan.io',
  },
  'base-sepolia': {
    viemChain: baseSepolia,
    contractAddress: TESTNET_IDENTITY,
    explorer: 'https://sepolia.basescan.org',
  },
  'arbitrum-sepolia': {
    viemChain: arbitrumSepolia,
    contractAddress: TESTNET_IDENTITY,
    explorer: 'https://sepolia.arbiscan.io',
  },
  'optimism-sepolia': {
    viemChain: optimismSepolia,
    contractAddress: TESTNET_IDENTITY,
    explorer: 'https://sepolia-optimistic.etherscan.io',
  },
  'polygon-amoy': {
    viemChain: polygonAmoy,
    contractAddress: TESTNET_IDENTITY,
    explorer: 'https://amoy.polygonscan.com',
  },
  'bsc-testnet': {
    viemChain: bscTestnet,
    contractAddress: TESTNET_IDENTITY,
    explorer: 'https://testnet.bscscan.com',
  },
}

// ─── Types ───────────────────────────────────────────────────────────────────

/** ERC-8004 service endpoint (A2A, MCP, web, etc.) */
export interface ERC8004Service {
  name: 'A2A' | 'MCP' | 'web' | 'OASF' | 'ENS' | 'DID' | (string & {})
  endpoint: string
  version?: string
}

/** Registration metadata stored on-chain as a data URI */
export interface ERC8004Registration {
  type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1'
  name: string
  description: string
  image?: string
  services: ERC8004Service[]
  x402Support: boolean
  active: boolean
  registrations: Array<{ agentId: number; agentRegistry: string }>
  supportedTrust: string[]
}

/** Resolved on-chain agent identity */
export interface AgentIdentity {
  tokenId: bigint
  owner: Address
  agentURI: string
  chain: string
  chainId: number
  contractAddress: Address
  explorerUrl: string
  registrationData?: ERC8004Registration
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveChainEntry(chain: string): ChainEntry {
  const entry = CHAIN_MAP[chain]
  if (!entry) {
    throw new Error(
      `Unknown chain: "${chain}". Supported: ${Object.keys(CHAIN_MAP).join(', ')}`
    )
  }
  return entry
}

function encodeAsDataURI(data: object): string {
  const json = JSON.stringify(data)
  const b64 = Buffer.from(json, 'utf-8').toString('base64')
  return `data:application/json;base64,${b64}`
}

function decodeAgentURI(uri: string): ERC8004Registration | undefined {
  try {
    if (uri.startsWith('data:application/json;base64,')) {
      const b64 = uri.slice('data:application/json;base64,'.length)
      return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'))
    }
    return JSON.parse(uri)
  } catch {
    return undefined
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Register an AI agent as an ERC-8004 on-chain identity (ERC-721 NFT).
 *
 * The agent metadata is encoded as a base64 data URI and stored directly
 * on-chain via the IdentityRegistry.register(string) function. On success
 * a token ID is minted to the caller's address.
 *
 * @example
 * const { tokenId, txHash, identityUrl } = await registerAgent({
 *   name: 'My Agent',
 *   description: 'Does useful things',
 *   evmPrivateKey: '0xabc...',
 *   chain: 'base',
 *   serviceUrl: 'https://myagent.example.com',
 * })
 */
export async function registerAgent(params: {
  name: string
  description: string
  evmPrivateKey: Hex
  /** Target chain — defaults to 'base' */
  chain?: ChainKey | (string & {})
  /** Agent's HTTP API endpoint (REST / A2A) */
  serviceUrl?: string
  /** MCP server URL */
  mcpUrl?: string
  /** x402 payment address (defaults to the signing address) */
  paymentAddress?: string
  imageUrl?: string
}): Promise<{ tokenId: bigint; txHash: string; identityUrl: string }> {
  const chainKey = params.chain ?? 'base'
  const { viemChain, contractAddress, explorer } = resolveChainEntry(chainKey)

  const account = privateKeyToAccount(params.evmPrivateKey)

  // Build ERC-8004 registration JSON
  const services: ERC8004Service[] = []
  if (params.serviceUrl) {
    services.push({ name: 'A2A', endpoint: params.serviceUrl })
  }
  if (params.mcpUrl) {
    services.push({ name: 'MCP', endpoint: params.mcpUrl })
  }

  const registration: ERC8004Registration = {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: params.name,
    description: params.description,
    ...(params.imageUrl ? { image: params.imageUrl } : {}),
    services,
    x402Support: Boolean(params.paymentAddress ?? params.serviceUrl),
    active: true,
    registrations: [],
    supportedTrust: ['reputation'],
  }

  const agentURI = encodeAsDataURI(registration)

  // Create viem wallet client
  const client = createWalletClient({
    account,
    chain: viemChain,
    transport: http(),
  }).extend(publicActions)

  // Simulate first to surface revert reasons early
  await client.simulateContract({
    address: contractAddress,
    abi: IDENTITY_ABI,
    functionName: 'register',
    args: [agentURI],
    account,
  })

  // Send transaction
  const txHash = await client.writeContract({
    address: contractAddress,
    abi: IDENTITY_ABI,
    functionName: 'register',
    args: [agentURI],
    account,
  })

  // Wait for receipt and extract tokenId from Registered event
  const receipt = await client.waitForTransactionReceipt({ hash: txHash })

  let tokenId = 0n
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: IDENTITY_ABI,
        eventName: 'Registered',
        topics: log.topics,
        data: log.data,
      })
      tokenId = (decoded.args as { agentId: bigint }).agentId
      break
    } catch {
      // not a Registered event — skip
    }
  }

  const identityUrl = `${explorer}/nft/${contractAddress}/${tokenId}`

  return { tokenId, txHash, identityUrl }
}

/**
 * Look up an agent's on-chain ERC-8004 identity by token ID.
 *
 * Returns null when the token does not exist on the target chain.
 */
export async function getAgentIdentity(
  tokenId: bigint,
  chain: string = 'base'
): Promise<AgentIdentity | null> {
  const { viemChain, contractAddress, explorer } = resolveChainEntry(chain)

  const publicClient = createPublicClient({
    chain: viemChain,
    transport: http(),
  })

  try {
    const [owner, agentURI] = await Promise.all([
      publicClient.readContract({
        address: contractAddress,
        abi: IDENTITY_ABI,
        functionName: 'ownerOf',
        args: [tokenId],
      }) as Promise<Address>,
      publicClient.readContract({
        address: contractAddress,
        abi: IDENTITY_ABI,
        functionName: 'tokenURI',
        args: [tokenId],
      }) as Promise<string>,
    ])

    const registrationData = decodeAgentURI(agentURI)

    return {
      tokenId,
      owner,
      agentURI,
      chain,
      chainId: viemChain.id,
      contractAddress,
      explorerUrl: `${explorer}/nft/${contractAddress}/${tokenId}`,
      ...(registrationData ? { registrationData } : {}),
    }
  } catch {
    // ownerOf reverts for non-existent tokens — treat as null
    return null
  }
}

/**
 * Return all ERC-8004 agent identities owned by a given address on a chain.
 *
 * Queries the Transfer events to enumerate all tokens minted to (or
 * transferred to) the owner, then filters to those still owned by them.
 */
export async function getAgentsByOwner(
  ownerAddress: Address,
  chain: string = 'base'
): Promise<AgentIdentity[]> {
  const { viemChain, contractAddress, explorer } = resolveChainEntry(chain)

  const publicClient = createPublicClient({
    chain: viemChain,
    transport: http(),
  })

  // Enumerate Transfer events where `to` == owner (mint or transfer-in)
  const transferLogs = await publicClient.getLogs({
    address: contractAddress,
    event: {
      name: 'Transfer',
      type: 'event',
      inputs: [
        { name: 'from', type: 'address', indexed: true },
        { name: 'to', type: 'address', indexed: true },
        { name: 'tokenId', type: 'uint256', indexed: true },
      ],
    },
    args: { to: ownerAddress },
    fromBlock: 'earliest',
    toBlock: 'latest',
  })

  // Collect unique token IDs
  const candidateIds = new Set<bigint>()
  for (const log of transferLogs) {
    const args = log.args as { tokenId?: bigint }
    if (args?.tokenId != null) candidateIds.add(args.tokenId)
  }

  if (candidateIds.size === 0) return []

  // Verify current ownership and fetch metadata in parallel
  const results = await Promise.allSettled(
    Array.from(candidateIds).map(async (tokenId) => {
      const [currentOwner, agentURI] = await Promise.all([
        publicClient.readContract({
          address: contractAddress,
          abi: IDENTITY_ABI,
          functionName: 'ownerOf',
          args: [tokenId],
        }) as Promise<Address>,
        publicClient.readContract({
          address: contractAddress,
          abi: IDENTITY_ABI,
          functionName: 'tokenURI',
          args: [tokenId],
        }) as Promise<string>,
      ])

      if (currentOwner.toLowerCase() !== ownerAddress.toLowerCase()) return null

      const registrationData = decodeAgentURI(agentURI)

      return {
        tokenId,
        owner: currentOwner,
        agentURI,
        chain,
        chainId: viemChain.id,
        contractAddress,
        explorerUrl: `${explorer}/nft/${contractAddress}/${tokenId}`,
        ...(registrationData ? { registrationData } : {}),
      } satisfies AgentIdentity
    })
  )

  return results
    .filter(
      (r): r is PromiseFulfilledResult<AgentIdentity> =>
        r.status === 'fulfilled' && r.value !== null
    )
    .map((r) => r.value)
}
