import { createPublicClient, createWalletClient, formatEther, formatUnits, getContract, http, parseUnits } from 'viem'
import { bsc } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

export { parseUnits }

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const

export interface BNBConfig {
  wallet: { privateKey: `0x${string}` }
  rpc?: string
}

export interface BNBInstance {
  address: string
  bnbBalance(): Promise<number>
  tokenBalance(tokenAddress: string): Promise<{ raw: bigint; formatted: string; symbol: string }>
  transfer(token: string, to: string, amount: bigint): Promise<string>
}

export function bnb(config: BNBConfig): BNBInstance {
  const { wallet, rpc } = config
  const account = privateKeyToAccount(wallet.privateKey)
  const transport = http(rpc)

  const publicClient = createPublicClient({ chain: bsc, transport })
  const walletClient = createWalletClient({ account, chain: bsc, transport })

  return {
    address: account.address,

    async bnbBalance(): Promise<number> {
      const raw = await publicClient.getBalance({ address: account.address })
      return parseFloat(formatEther(raw))
    },

    async tokenBalance(tokenAddress: string) {
      const contract = getContract({ address: tokenAddress as `0x${string}`, abi: ERC20_ABI, client: publicClient })
      const [raw, decimals, symbol] = await Promise.all([
        contract.read.balanceOf([account.address]) as Promise<bigint>,
        contract.read.decimals() as Promise<number>,
        contract.read.symbol() as Promise<string>,
      ])
      return { raw, formatted: formatUnits(raw, decimals), symbol }
    },

    async transfer(token: string, to: string, amount: bigint): Promise<string> {
      const contract = getContract({ address: token as `0x${string}`, abi: ERC20_ABI, client: { public: publicClient, wallet: walletClient } })
      const hash = await contract.write.transfer([to as `0x${string}`, amount])
      return hash
    },
  }
}

/** BNB token price in USD via PancakeSwap V3 subgraph. */
export async function getBnbTokenPrice(tokenAddress: string): Promise<number> {
  const query = `{
    token(id: "${tokenAddress.toLowerCase()}") {
      tokenDayData(first: 1, orderBy: date, orderDirection: desc) {
        priceUSD
      }
    }
  }`

  const res = await fetch('https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v3-bsc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })

  if (!res.ok) throw new Error(`PancakeSwap subgraph error: ${res.status}`)
  const data = await res.json() as { data?: { token?: { tokenDayData?: { priceUSD: string }[] } } }
  const price = data.data?.token?.tokenDayData?.[0]?.priceUSD
  if (!price) throw new Error(`No price data found for ${tokenAddress}`)
  return parseFloat(price)
}

/** Swap tokens on PancakeSwap V3 via router (requires wallet). */
export async function swapBnbTokens(config: BNBConfig, params: {
  tokenIn: string
  tokenOut: string
  amountIn: bigint
  slippageBps?: number
}): Promise<string> {
  const { wallet, rpc } = config
  const account = privateKeyToAccount(wallet.privateKey)
  const transport = http(rpc)
  const walletClient = createWalletClient({ account, chain: bsc, transport })
  const publicClient = createPublicClient({ chain: bsc, transport })

  const PANCAKE_V3_ROUTER = '0x1b81D678ffb9C0263b24A97847620C99d213eB14' as const
  const { tokenIn, tokenOut, amountIn, slippageBps = 50 } = params

  // Approve router
  const approveTx = await walletClient.writeContract({
    address: tokenIn as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [PANCAKE_V3_ROUTER, amountIn],
  })
  await publicClient.waitForTransactionReceipt({ hash: approveTx })

  // ExactInputSingle call
  const ROUTER_ABI = [
    {
      name: 'exactInputSingle',
      type: 'function',
      stateMutability: 'payable',
      inputs: [{
        name: 'params', type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      }],
      outputs: [{ name: 'amountOut', type: 'uint256' }],
    },
  ] as const

  const hash = await walletClient.writeContract({
    address: PANCAKE_V3_ROUTER,
    abi: ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [{
      tokenIn: tokenIn as `0x${string}`,
      tokenOut: tokenOut as `0x${string}`,
      fee: 2500,
      recipient: account.address,
      amountIn,
      amountOutMinimum: BigInt(0),
      sqrtPriceLimitX96: BigInt(0),
    }],
  })

  return hash
}
