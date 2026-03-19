import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, http, parseEther, parseUnits, createPublicClient } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Base Sepolia USDC
const MIN_USDC_BALANCE = 0.05;
const MIN_ETH_BALANCE = 0.001;

const USDC_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  }
] as const;

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, currentBalances } = await req.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    let faucetPrivateKey = process.env.FAUCET_PRIVATE_KEY;
    if (!faucetPrivateKey) {
      return NextResponse.json(
        {
          funded: false,
          message: 'Faucet not configured. Please add FAUCET_PRIVATE_KEY to environment variables.',
          skipFaucet: true
        },
        { status: 200 }
      );
    }

    // Ensure private key has 0x prefix
    if (!faucetPrivateKey.startsWith('0x')) {
      faucetPrivateKey = `0x${faucetPrivateKey}`;
    }

    const usdcBalance = parseFloat(currentBalances?.usdc || '0');
    const ethBalance = parseFloat(currentBalances?.eth || '0');

    const needsUSDC = usdcBalance < MIN_USDC_BALANCE;
    const needsETH = ethBalance < MIN_ETH_BALANCE;

    if (!needsUSDC && !needsETH) {
      return NextResponse.json({
        funded: false,
        message: 'Wallet has sufficient balance'
      });
    }

    const account = privateKeyToAccount(faucetPrivateKey as `0x${string}`);

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http()
    });

    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http()
    });

    const transactions: { type: string; hash: string; amount: string }[] = [];

    // Get current nonce - use 'latest' to avoid pending transaction conflicts
    const currentNonce = await publicClient.getTransactionCount({
      address: account.address,
      blockTag: 'latest'
    });

    // Send USDC if needed
    if (needsUSDC) {
      const usdcAmount = process.env.FAUCET_USDC_AMOUNT || '1';
      const amountToSend = parseUnits(usdcAmount, 6); // USDC has 6 decimals

      console.log(`[Faucet] Sending ${usdcAmount} USDC to ${walletAddress} with nonce ${currentNonce}`);

      const hash = await walletClient.writeContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [walletAddress as `0x${string}`, amountToSend],
        nonce: currentNonce
      } as any);

      console.log(`[Faucet] USDC transaction sent: ${hash}`);

      // Wait for USDC transaction to be confirmed
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
        timeout: 60_000 // 60 second timeout
      });

      console.log(`[Faucet] USDC transaction confirmed in block ${receipt.blockNumber}`);

      transactions.push({
        type: 'USDC',
        hash,
        amount: usdcAmount
      });
    }

    // Send ETH if needed (using next nonce if USDC was sent)
    if (needsETH) {
      const ethAmount = process.env.FAUCET_ETH_AMOUNT || '0.01';
      const amountToSend = parseEther(ethAmount);

      // Get fresh nonce after USDC confirmation
      const ethNonce = await publicClient.getTransactionCount({
        address: account.address,
        blockTag: 'latest'
      });

      console.log(`[Faucet] Sending ${ethAmount} ETH to ${walletAddress} with nonce ${ethNonce}`);

      const hash = await walletClient.sendTransaction({
        to: walletAddress as `0x${string}`,
        value: amountToSend,
        nonce: ethNonce
      } as any);

      console.log(`[Faucet] ETH transaction sent: ${hash}`);

      // Wait for ETH transaction to be confirmed
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
        timeout: 60_000 // 60 second timeout
      });

      console.log(`[Faucet] ETH transaction confirmed in block ${receipt.blockNumber}`);

      transactions.push({
        type: 'ETH',
        hash,
        amount: ethAmount
      });
    }

    return NextResponse.json({
      funded: true,
      transactions,
      message: `Funded with ${transactions.map(t => `${t.amount} ${t.type}`).join(' and ')}`
    });

  } catch (error: any) {
    console.error('[Faucet] Error details:', error);

    // Return user-friendly error messages
    let errorMessage = 'Failed to fund wallet';

    if (error?.message?.includes('timeout') || error?.message?.includes('timed out')) {
      errorMessage = 'Transaction is taking longer than expected. It may still complete. Please check your balance in a minute.';
    } else if (error?.message?.includes('nonce')) {
      errorMessage = 'Nonce conflict detected. Please wait 30 seconds and try again.';
    } else if (error?.message?.includes('insufficient funds')) {
      errorMessage = 'Faucet wallet has insufficient funds. Please contact support to refill the faucet.';
    } else if (error?.message?.includes('replacement transaction underpriced')) {
      errorMessage = 'Transaction already in progress. Please wait 30 seconds and try again.';
    } else if (error?.message?.includes('gas')) {
      errorMessage = 'Gas estimation failed. The network may be congested. Please try again.';
    } else {
      errorMessage = error?.message || 'Failed to fund wallet';
    }

    return NextResponse.json(
      {
        funded: false,
        error: errorMessage,
        skipFaucet: true // Skip UI error display
      },
      { status: 200 } // Return 200 to prevent console errors
    );
  }
}

