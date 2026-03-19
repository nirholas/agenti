import { createPublicClient, createWalletClient, http, type Address, type Hash } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import crypto from 'crypto';

const VALIDATION_REGISTRY_ABI = [
  {
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'dataHash', type: 'bytes32' },
      { name: 'metadata', type: 'string' },
    ],
    name: 'validationRequest',
    outputs: [{ name: 'requestId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'requestId', type: 'uint256' },
      { name: 'verdict', type: 'bool' },
      { name: 'evidence', type: 'bytes' },
    ],
    name: 'validationResponse',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export async function linkAgentIdentity(params: {
  agentId: string;
  txHash: string;
  chain: string;
  amount: bigint;
  paymentData: any;
}): Promise<{ evidenceHash: string; proofOfAgency: string } | null> {
  if (!process.env.CHAOSCHAIN_ENABLED || process.env.CHAOSCHAIN_ENABLED !== 'true') {
    // Skip ERC-8004 integration if not enabled
    console.log('[ChaosChain] ERC-8004 integration disabled');
    return null;
  }
  
  if (!process.env.VALIDATION_REGISTRY_ADDRESS) {
    console.warn('[ChaosChain] VALIDATION_REGISTRY_ADDRESS not configured');
    return null;
  }

  const account = privateKeyToAccount(process.env.FACILITATOR_PRIVATE_KEY! as `0x${string}`);
  
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL!),
  });

  // Create evidence package hash from payment data
  const evidencePackage = {
    txHash: params.txHash,
    chain: params.chain,
    amount: params.amount.toString(),
    agentId: params.agentId,
    timestamp: Date.now(),
    facilitator: 'chaoschain-x402',
  };
  
  const evidenceJson = JSON.stringify(evidencePackage, Object.keys(evidencePackage).sort());
  const evidenceHash = `0x${crypto.createHash('sha256').update(evidenceJson).digest('hex')}` as `0x${string}`;

  // Call ValidationRegistry.validationRequest()
  try {
    const registryAddress = process.env.VALIDATION_REGISTRY_ADDRESS! as Address;
    const hash = await walletClient.writeContract({
      address: registryAddress,
      abi: VALIDATION_REGISTRY_ABI,
      functionName: 'validationRequest',
      args: [
        BigInt(params.agentId),
        evidenceHash,
        JSON.stringify({ 
          txHash: params.txHash, 
          facilitator: 'chaoschain-x402',
          chain: params.chain,
        }),
      ],
    });

    return {
      evidenceHash,
      proofOfAgency: hash,
    };
  } catch (error) {
    console.error('Failed to link agent identity:', error);
    return {
      evidenceHash,
      proofOfAgency: '0x0',
    };
  }
}

