import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, formatEther, formatUnits } from 'viem';
import { baseSepolia } from 'viem/chains';

const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Base Sepolia USDC
const RPC_URL = process.env.RPC_URL;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const walletAddress = searchParams.get('address');

  if (!walletAddress) {
    return NextResponse.json(
      { error: 'Wallet address is required' },
      { status: 400 }
    );
  }

  try {
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(RPC_URL)
    });

    // Fetch ETH balance
    const ethBalanceWei = await publicClient.getBalance({
      address: walletAddress as `0x${string}`
    });
    const ethBalance = formatEther(ethBalanceWei);

    // Fetch USDC balance
    const usdcBalanceRaw = await publicClient.readContract({
      address: USDC_ADDRESS as `0x${string}`,
      abi: [
        {
          name: 'balanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
        },
      ] as const,
      functionName: 'balanceOf',
      args: [walletAddress as `0x${string}`],
    } as any);

    const usdcBalance = formatUnits(usdcBalanceRaw as bigint, 6);

    return NextResponse.json({
      eth: parseFloat(ethBalance).toFixed(6),
      usdc: parseFloat(usdcBalance).toFixed(6)
    });

  } catch (error) {
    console.error('Failed to fetch balances:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balances', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

