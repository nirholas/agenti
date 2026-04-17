import fs from 'fs'
import path from 'path'
import type { AbiItem } from './parser.js'

const ETHERSCAN_ENDPOINTS: Record<string, string> = {
  eth: 'https://api.etherscan.io/api',
  mainnet: 'https://api.etherscan.io/api',
  base: 'https://api.basescan.org/api',
  arbitrum: 'https://api.arbiscan.io/api',
  optimism: 'https://api-optimistic.etherscan.io/api',
  polygon: 'https://api.polygonscan.com/api',
  bsc: 'https://api.bscscan.com/api',
  avalanche: 'https://api.snowtrace.io/api',
}

const SOURCIFY_CHAIN_IDS: Record<string, number> = {
  eth: 1,
  mainnet: 1,
  base: 8453,
  arbitrum: 42161,
  optimism: 10,
  polygon: 137,
  bsc: 56,
  avalanche: 43114,
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

export async function fetchAbi(source: string, chain = 'mainnet'): Promise<AbiItem[]> {
  // Local JSON file
  if (!source.startsWith('0x') && !source.startsWith('http')) {
    const filePath = path.resolve(source)
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as AbiItem[] | { abi: AbiItem[] }
    // Support both bare ABI arrays and Hardhat/Foundry artifact format
    return Array.isArray(parsed) ? parsed : (parsed as { abi: AbiItem[] }).abi
  }

  // URL
  if (source.startsWith('http')) {
    const res = await fetch(source)
    if (!res.ok) throw new Error(`Failed to fetch ABI from URL: ${res.statusText}`)
    const parsed = (await res.json()) as AbiItem[] | { abi: AbiItem[] }
    return Array.isArray(parsed) ? parsed : (parsed as { abi: AbiItem[] }).abi
  }

  // Contract address — try Etherscan → Sourcify → 4byte
  if (!ADDRESS_RE.test(source)) {
    throw new Error(`Invalid source: "${source}". Must be a file path, URL, or 0x address.`)
  }

  const abi =
    (await tryEtherscan(source, chain)) ??
    (await trySourcify(source, chain)) ??
    null

  if (!abi) {
    throw new Error(
      `Could not fetch ABI for ${source} on ${chain}. ` +
        `Contract may not be verified. Try providing the ABI file directly.`
    )
  }

  return abi
}

async function tryEtherscan(address: string, chain: string): Promise<AbiItem[] | null> {
  const apiUrl = ETHERSCAN_ENDPOINTS[chain]
  if (!apiUrl) return null

  const apiKey = process.env['ETHERSCAN_API_KEY'] ?? ''
  const params = new URLSearchParams({
    module: 'contract',
    action: 'getabi',
    address,
    ...(apiKey ? { apikey: apiKey } : {}),
  })

  try {
    const res = await fetch(`${apiUrl}?${params}`)
    if (!res.ok) return null
    const data = (await res.json()) as { status: string; result: string }
    if (data.status !== '1') return null
    return JSON.parse(data.result)
  } catch {
    return null
  }
}

async function trySourcify(address: string, chain: string): Promise<AbiItem[] | null> {
  const chainId = SOURCIFY_CHAIN_IDS[chain]
  if (!chainId) return null

  const base = 'https://sourcify.dev/server'
  for (const matchType of ['full_match', 'partial_match']) {
    try {
      const res = await fetch(`${base}/files/${matchType}/${chainId}/${address}`)
      if (!res.ok) continue
      const files = (await res.json()) as Array<{ name: string; content: string }>
      const meta = files.find((f) => f.name === 'metadata.json')
      if (!meta) continue
      const metadata = JSON.parse(meta.content) as { output?: { abi?: AbiItem[] } }
      if (metadata.output?.abi) return metadata.output.abi
    } catch {
      continue
    }
  }
  return null
}
