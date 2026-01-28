import { ethers } from 'ethers';
import { ChainId, PaymentRequest, PaymentTransaction, Token } from '../types';
import { getBestSwapQuote, calculatePlatformFee } from '../swap/aggregator';
import { resolveUsername, recordPaymentReceived } from '../username/registry';

// Chain RPC endpoints
const RPC_ENDPOINTS: Record<ChainId, string> = {
  1: `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
  10: `https://opt-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
  137: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
  42161: `https://arb-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
  8453: `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`,
};

// Payment Router ABI (simplified)
const PAYMENT_ROUTER_ABI = [
  'function swapAndPay(address inputToken, uint256 inputAmount, address recipient, uint256 minOutput, bytes calldata swapData) payable returns (uint256)',
  'function payWithETH(address recipient, uint256 minOutput, bytes calldata swapData) payable returns (uint256)',
  'event PaymentProcessed(address indexed sender, address indexed recipient, address inputToken, uint256 inputAmount, uint256 outputAmount)',
];

interface PaymentParams {
  inputToken: Token;
  inputAmount: string;
  recipient: string; // address or username
  chainId: ChainId;
  slippageBps?: number; // default 50 = 0.5%
}

/**
 * Prepare a payment transaction
 */
export async function preparePayment(
  params: PaymentParams,
  senderAddress: string
): Promise<{
  transaction: ethers.TransactionRequest;
  quote: Awaited<ReturnType<typeof getBestSwapQuote>>['quote'];
  estimatedOutput: string;
  fees: { platform: string; gas: string };
}> {
  const { inputToken, inputAmount, recipient, chainId, slippageBps = 50 } = params;

  // Resolve recipient if it's a username
  let recipientAddress = recipient;
  if (recipient.startsWith('@') || !recipient.startsWith('0x')) {
    const resolved = resolveUsername(recipient);
    if (!resolved) {
      throw new Error(`Username ${recipient} not found`);
    }
    recipientAddress = resolved;
  }

  // Get swap quote
  const { quote, calldata, to, value } = await getBestSwapQuote(
    inputToken,
    inputAmount,
    chainId,
    senderAddress
  );

  // Calculate platform fee
  const platformFee = calculatePlatformFee(quote.outputAmount);
  const netOutput = (BigInt(quote.outputAmount) - BigInt(platformFee)).toString();

  // Calculate minimum output with slippage
  const minOutput = (BigInt(netOutput) * BigInt(10000 - slippageBps)) / BigInt(10000);

  // Prepare transaction
  const routerAddress = getRouterAddress(chainId);
  const provider = new ethers.JsonRpcProvider(RPC_ENDPOINTS[chainId]);
  const router = new ethers.Contract(routerAddress, PAYMENT_ROUTER_ABI, provider);

  let transaction: ethers.TransactionRequest;

  if (inputToken.address === ethers.ZeroAddress) {
    // Native ETH payment
    transaction = {
      to: routerAddress,
      data: router.interface.encodeFunctionData('payWithETH', [
        recipientAddress,
        minOutput.toString(),
        calldata,
      ]),
      value: BigInt(inputAmount),
      chainId,
    };
  } else {
    // ERC20 payment
    transaction = {
      to: routerAddress,
      data: router.interface.encodeFunctionData('swapAndPay', [
        inputToken.address,
        inputAmount,
        recipientAddress,
        minOutput.toString(),
        calldata,
      ]),
      value: BigInt(value),
      chainId,
    };
  }

  // Estimate gas
  const gasEstimate = await provider.estimateGas({
    ...transaction,
    from: senderAddress,
  });

  return {
    transaction: {
      ...transaction,
      gasLimit: gasEstimate * BigInt(120) / BigInt(100), // 20% buffer
    },
    quote,
    estimatedOutput: netOutput,
    fees: {
      platform: platformFee,
      gas: gasEstimate.toString(),
    },
  };
}

/**
 * Monitor transaction and record payment
 */
export async function monitorPayment(
  txHash: string,
  chainId: ChainId,
  paymentRequest: PaymentRequest
): Promise<PaymentTransaction> {
  const provider = new ethers.JsonRpcProvider(RPC_ENDPOINTS[chainId]);
  
  // Wait for confirmation
  const receipt = await provider.waitForTransaction(txHash, 1); // 1 confirmation
  
  if (!receipt || receipt.status === 0) {
    throw new Error('Transaction failed');
  }

  // Parse the PaymentProcessed event
  const routerAddress = getRouterAddress(chainId);
  const router = new ethers.Contract(routerAddress, PAYMENT_ROUTER_ABI, provider);
  
  const logs = receipt.logs.filter(
    log => log.address.toLowerCase() === routerAddress.toLowerCase()
  );
  
  let sender = '';
  let inputToken = '';
  let inputAmount = '0';
  let outputAmount = '0';

  for (const log of logs) {
    try {
      const parsed = router.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (parsed?.name === 'PaymentProcessed') {
        sender = parsed.args.sender;
        inputToken = parsed.args.inputToken;
        inputAmount = parsed.args.inputAmount.toString();
        outputAmount = parsed.args.outputAmount.toString();
        break;
      }
    } catch {
      continue;
    }
  }

  // Record payment for recipient stats
  recordPaymentReceived(paymentRequest.recipient, outputAmount);

  return {
    id: txHash,
    paymentRequestId: paymentRequest.id,
    sender,
    recipient: paymentRequest.recipient,
    inputToken: {
      address: inputToken,
      symbol: '',
      decimals: 18,
      chainId,
    },
    inputAmount,
    outputAmount,
    txHash,
    chainId,
    status: 'confirmed',
    createdAt: new Date(),
    confirmedAt: new Date(),
  };
}

/**
 * Get router contract address for chain
 */
function getRouterAddress(chainId: ChainId): string {
  const addresses: Record<ChainId, string> = {
    1: process.env.PAYMENT_ROUTER_ETH || '',
    10: process.env.PAYMENT_ROUTER_OP || '',
    137: process.env.PAYMENT_ROUTER_POLYGON || '',
    42161: process.env.PAYMENT_ROUTER_ARB || '',
    8453: process.env.PAYMENT_ROUTER_BASE || '',
  };
  
  const address = addresses[chainId];
  if (!address) {
    throw new Error(`Payment router not deployed on chain ${chainId}`);
  }
  return address;
}

/**
 * Get supported tokens for a chain
 */
export async function getSupportedTokens(chainId: ChainId): Promise<Token[]> {
  // In production, fetch from token list or API
  // This is a simplified example
  const commonTokens: Record<ChainId, Token[]> = {
    1: [
      { address: ethers.ZeroAddress, symbol: 'ETH', decimals: 18, chainId: 1 },
      { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18, chainId: 1 },
      { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', decimals: 8, chainId: 1 },
      { address: '0x6B175474E89094C44Da98b954EesdeAD3F622f60', symbol: 'DAI', decimals: 18, chainId: 1 },
    ],
    42161: [
      { address: ethers.ZeroAddress, symbol: 'ETH', decimals: 18, chainId: 42161 },
      { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', symbol: 'WETH', decimals: 18, chainId: 42161 },
      { address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', symbol: 'WBTC', decimals: 8, chainId: 42161 },
    ],
    8453: [
      { address: ethers.ZeroAddress, symbol: 'ETH', decimals: 18, chainId: 8453 },
      { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18, chainId: 8453 },
    ],
    10: [
      { address: ethers.ZeroAddress, symbol: 'ETH', decimals: 18, chainId: 10 },
      { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18, chainId: 10 },
    ],
    137: [
      { address: ethers.ZeroAddress, symbol: 'MATIC', decimals: 18, chainId: 137 },
      { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', symbol: 'WETH', decimals: 18, chainId: 137 },
    ],
  };

  return commonTokens[chainId] || [];
}
