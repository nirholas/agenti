import { createPublicClient, http, formatEther, formatUnits, defineChain } from 'viem';
import { base, baseSepolia, mainnet, sepolia } from 'viem/chains';
import { createClient } from '@supabase/supabase-js';
import { privateKeyToAccount } from 'viem/accounts';
import { skaleBaseSepolia } from '../config/networks/eip155-324705682';

// Define 0G Mainnet
const zgMainnet = defineChain({
  id: 16661,
  name: '0G Mainnet',
  network: '0g',
  nativeCurrency: { decimals: 18, name: '0G', symbol: '0G' },
  rpcUrls: {
    default: { http: ['https://evmrpc.0g.ai'] },
    public: { http: ['https://evmrpc.0g.ai'] },
  },
  blockExplorers: {
    default: { name: '0G Explorer', url: 'https://chainscan.0g.ai' },
  },
});

// Network configurations
const NETWORKS = {
  'base-sepolia': {
    chain: baseSepolia,
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    tokenSymbol: 'USDC',
  },
  'ethereum-sepolia': {
    chain: sepolia,
    rpcUrl: process.env.ETHEREUM_SEPOLIA_RPC_URL,
    tokenSymbol: 'USDC',
  },
  'skale-base-sepolia': {
    chain: skaleBaseSepolia as any,
    rpcUrl: process.env.SKALE_BASE_SEPOLIA_RPC_URL || 'https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha',
    tokenSymbol: 'USDC',
  },
  'base-mainnet': {
    chain: base,
    rpcUrl: process.env.BASE_MAINNET_RPC_URL,
    tokenSymbol: 'USDC',
  },
  'ethereum-mainnet': {
    chain: mainnet,
    rpcUrl: process.env.ETHEREUM_MAINNET_RPC_URL,
    tokenSymbol: 'USDC',
  },
  '0g-mainnet': {
    chain: zgMainnet,
    rpcUrl: process.env.ZG_MAINNET_RPC_URL || 'https://evmrpc.0g.ai',
    tokenSymbol: 'W0G',
  },
};

// Lazy load Supabase (optional for testing)
function getSupabaseClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return null;
  }
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
}

async function checkNetwork(networkName: string, config: any, facilitatorAddress: string) {
  if (!config.rpcUrl) {
    return {
      rpcHealthy: false,
      gasBalance: '0',
      token: config.tokenSymbol,
      error: 'RPC URL not configured',
    };
  }

  try {
    const client = createPublicClient({
      chain: config.chain,
      transport: http(config.rpcUrl),
    });

    // Check if RPC is reachable
    const balance = await client.getBalance({ address: facilitatorAddress as `0x${string}` });
    
    return {
      rpcHealthy: true,
      gasBalance: formatEther(balance),
      token: config.tokenSymbol,
    };
  } catch (e: any) {
    return {
      rpcHealthy: false,
      gasBalance: '0',
      token: config.tokenSymbol,
      error: e.message || 'RPC check failed',
    };
  }
}

export async function checkHealth() {
  // Get facilitator address from private key if available
  let facilitatorAddress: string;
  try {
    const privateKey = process.env.FACILITATOR_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('FACILITATOR_PRIVATE_KEY not set');
    }
    const pkWithPrefix = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    facilitatorAddress = privateKeyToAccount(pkWithPrefix as `0x${string}`).address;
  } catch (e: any) {
    return {
      healthy: false,
      facilitatorMode: 'managed',
      networks: {},
      error: `Facilitator configuration error: ${e.message}`,
      timestamp: new Date().toISOString(),
    };
  }

  // Check Supabase (optional)
  let supabaseHealthy = true;
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { error } = await supabase.from('transactions').select('count').limit(1);
      supabaseHealthy = !error;
    } catch (e) {
      supabaseHealthy = false;
    }
  }

  // Check all networks in parallel
  const networkChecks = await Promise.all(
    Object.entries(NETWORKS).map(async ([name, config]) => {
      const result = await checkNetwork(name, config, facilitatorAddress);
      return [name, result];
    })
  );

  const networks = Object.fromEntries(networkChecks);

  // Overall health: Supabase OK + at least one network healthy
  const anyNetworkHealthy = Object.values(networks).some((n: any) => n.rpcHealthy);
  const healthy = supabaseHealthy && anyNetworkHealthy;

  // Create public-safe network status (no gas balances or addresses)
  const publicNetworkStatus = Object.fromEntries(
    Object.entries(networks).map(([name, data]: [string, any]) => [
      name,
      {
        rpcHealthy: data.rpcHealthy,
        token: data.token,
        status: data.rpcHealthy ? 'operational' : 'degraded',
        ...(data.error && { error: data.error })
      }
    ])
  );

  return {
    healthy,
    facilitatorMode: 'managed',
    networks: publicNetworkStatus,
    timestamp: new Date().toISOString(),
  };
}

