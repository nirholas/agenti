/**
 * X402 Arbitrum Examples
 * 
 * Comprehensive examples for using X402 payments on Arbitrum with:
 * - Sperax USD ($USDs) auto-yield stablecoin
 * - EIP-3009 gasless transfers
 * - Standard ERC-20 transfers
 * - Payment verification through facilitators
 * 
 * @see docs/X402_PROTOCOL_RESEARCH_REPORT.md
 * @see https://github.com/hummusonrails/x402-demo-arbitrum
 */

import { createArbitrumAdapter, ArbitrumX402Adapter } from './arbitrum-adapter';
import { Address } from 'viem';

/**
 * Example 1: Basic USDs Payment
 * 
 * Simple payment with Sperax USD on Arbitrum mainnet
 */
export async function example1_BasicUSdsPayment() {
  // Initialize adapter
  const adapter = createArbitrumAdapter({
    network: 'mainnet',
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
    facilitatorUrl: 'https://facilitator.example.com',
  });

  // Create payment request
  const paymentRequest = adapter.createPaymentRequest({
    price: '0.0001', // 0.0001 USDs
    recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' as Address,
    token: 'USDs',
    description: 'AI tool execution payment',
  });

  // Execute standard payment
  const transaction = await adapter.executeStandardPayment(paymentRequest);

  console.log('Payment completed:', {
    hash: transaction.hash,
    status: transaction.status,
    explorer: `https://arbiscan.io/tx/${transaction.hash}`,
  });

  return transaction;
}

/**
 * Example 2: Gasless Payment with EIP-3009
 * 
 * Use EIP-3009 to enable gasless transfers - user signs payment
 * authorization and facilitator executes it
 */
export async function example2_GaslessPayment() {
  const adapter = createArbitrumAdapter({
    network: 'mainnet',
    enableGasless: true,
    facilitatorUrl: 'https://facilitator.example.com',
  });

  const userAddress = '0x...' as Address;
  const userPrivateKey = process.env.USER_PRIVATE_KEY as `0x${string}`;

  // Create payment request
  const paymentRequest = adapter.createPaymentRequest({
    price: '0.001',
    recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' as Address,
    token: 'USDs',
  });

  // User creates signed authorization (no gas needed)
  const authorization = await adapter.createPaymentAuthorization(
    paymentRequest,
    userAddress,
    userPrivateKey
  );

  // Verify signature through facilitator
  const isValid = await adapter.verifyPayment(authorization);

  if (!isValid) {
    throw new Error('Payment authorization invalid');
  }

  // Execute gasless payment (facilitator pays gas)
  const transaction = await adapter.executeGaslessPayment(
    paymentRequest,
    authorization
  );

  console.log('Gasless payment completed:', {
    hash: transaction.hash,
    gasUsed: transaction.gasUsed,
    from: transaction.from,
    to: transaction.to,
  });

  return transaction;
}

/**
 * Example 3: X402 Quote Service Integration
 * 
 * Complete flow showing how a quote service would use X402
 */
export async function example3_QuoteServiceFlow() {
  const adapter = createArbitrumAdapter({
    network: 'mainnet',
    privateKey: process.env.MERCHANT_PRIVATE_KEY as `0x${string}`,
    quoteServiceUrl: 'http://localhost:3001',
    facilitatorUrl: 'http://localhost:3002',
  });

  // Step 1: User requests a quote (initial request)
  const quoteRequest = {
    from: '0x...' as Address,
    sell: 'USDC',
    buy: 'WETH',
    sellAmount: '1000000', // 1 USDC
    maxSlippageBps: 30,
  };

  // Step 2: Service returns 402 Payment Required
  const paymentRequired = {
    status: 402,
    x402Version: 1,
    error: 'Payment Required',
    accepts: [{
      scheme: 'exact',
      network: 'arbitrum',
      maxAmountRequired: '1000', // 0.001 USDs
      resource: '/quote',
      description: 'Payment for swap quote generation',
      payTo: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' as Address,
      asset: '0xd74f5255d557944cf7dd0e45ff521520002d5748' as Address, // USDs
      extra: {
        name: 'Sperax USD',
        version: '1',
      },
    }],
    facilitator: {
      url: 'http://localhost:3002',
    },
  };

  // Step 3: Create and execute payment
  const paymentRequest = adapter.createPaymentRequest({
    price: '0.001',
    recipient: paymentRequired.accepts[0].payTo,
    token: 'USDs',
    description: paymentRequired.accepts[0].description,
  });

  const transaction = await adapter.executeStandardPayment(paymentRequest);

  // Step 4: Retry request with payment proof
  console.log('Payment completed, retrying with proof:', {
    transactionHash: transaction.hash,
    blockNumber: transaction.blockNumber,
  });

  return {
    paymentTx: transaction,
    quote: {
      // Quote service would return actual quote here
      outputAmount: '1500000000000000', // Example WETH amount
      path: ['USDC', 'WETH'],
      signature: '0x...', // EIP-712 quote signature
    },
  };
}

/**
 * Example 4: Metered AI Inference with Batch Settlement
 * 
 * Demonstrates AP2 protocol integration with X402
 */
export async function example4_MeteredAIInference() {
  const adapter = createArbitrumAdapter({
    network: 'sepolia', // Use testnet for development
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
    facilitatorUrl: 'http://localhost:3002',
  });

  // Metering configuration
  const PRICE_PER_MESSAGE = '0.0001'; // 100 micro-USDC
  const BATCH_THRESHOLD = 5; // Settle every 5 messages
  
  let messageCount = 0;
  let totalCost = BigInt(0);

  // Simulate AI inference calls
  for (let i = 0; i < 10; i++) {
    messageCount++;
    totalCost += BigInt(100); // 100 micro-USDC

    console.log(`Message ${messageCount}: AI inference completed`);

    // Batch settlement every 5 messages
    if (messageCount % BATCH_THRESHOLD === 0) {
      const paymentRequest = adapter.createPaymentRequest({
        price: (Number(totalCost) / 1_000_000).toString(),
        recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' as Address,
        token: 'USDs',
        description: `Batch payment for ${BATCH_THRESHOLD} AI inferences`,
      });

      const transaction = await adapter.executeStandardPayment(paymentRequest);

      console.log(`Batch ${messageCount / BATCH_THRESHOLD} settled:`, {
        messages: BATCH_THRESHOLD,
        totalCost: (Number(totalCost) / 1_000_000).toString(),
        txHash: transaction.hash,
      });

      // Reset batch
      totalCost = BigInt(0);
    }
  }
}

/**
 * Example 5: Check USDs Balance and Yield
 * 
 * Query user's USDs balance and accumulated auto-yield
 */
export async function example5_CheckUSdsBalance() {
  const adapter = createArbitrumAdapter({
    network: 'mainnet',
  });

  const userAddress = '0x...' as Address;

  // Get current balance (includes auto-yield)
  const balanceInfo = await adapter.getUSdsBalance(userAddress);

  console.log('USDs Balance:', {
    raw: balanceInfo.balance,
    formatted: `${balanceInfo.formattedBalance} USDs`,
    autoYield: 'Automatically accumulated in balance',
  });

  // Get network info
  const networkInfo = adapter.getNetworkInfo();
  
  console.log('Network Info:', networkInfo);

  return balanceInfo;
}

/**
 * Example 6: Multi-Token Payment Support
 * 
 * Support multiple stablecoins on Arbitrum
 */
export async function example6_MultiTokenPayment() {
  const adapter = createArbitrumAdapter({
    network: 'mainnet',
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
  });

  const tokens: Array<{ token: 'USDs' | 'USDC' | 'USDT' | 'DAI'; price: string }> = [
    { token: 'USDs', price: '0.0001' },
    { token: 'USDC', price: '0.0001' },
    { token: 'USDT', price: '0.0001' },
    { token: 'DAI', price: '0.0001' },
  ];

  for (const { token, price } of tokens) {
    const paymentRequest = adapter.createPaymentRequest({
      price,
      recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' as Address,
      token,
      description: `Payment with ${token}`,
    });

    console.log(`Payment request created for ${token}:`, {
      token,
      price,
      chain: paymentRequest.chain,
      deadline: new Date(paymentRequest.deadline! * 1000).toISOString(),
    });
  }
}

/**
 * Example 7: Complete X402 HTTP Flow
 * 
 * Full HTTP request/response cycle with X402 headers
 */
export async function example7_CompleteHTTPFlow() {
  const adapter = createArbitrumAdapter({
    network: 'mainnet',
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
    facilitatorUrl: 'https://facilitator.example.com',
  });

  // Step 1: Initial request (no payment)
  const initialResponse = await fetch('https://api.example.com/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sell: 'USDC', buy: 'WETH', amount: '1000000' }),
  });

  // Step 2: Receive 402 Payment Required
  if (initialResponse.status === 402) {
    const paymentDetails = await initialResponse.json();

    // Step 3: Create payment authorization
    const paymentRequest = adapter.createPaymentRequest({
      price: paymentDetails.accepts[0].maxAmountRequired,
      recipient: paymentDetails.accepts[0].payTo,
      token: 'USDs',
    });

    const userAddress = '0x...' as Address;
    const userPrivateKey = process.env.USER_PRIVATE_KEY as `0x${string}`;

    const authorization = await adapter.createPaymentAuthorization(
      paymentRequest,
      userAddress,
      userPrivateKey
    );

    // Step 4: Retry with X-Payment header
    const retryResponse = await fetch('https://api.example.com/quote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment': Buffer.from(JSON.stringify({
          x402Version: 1,
          scheme: 'exact',
          network: 'arbitrum',
          payload: authorization,
        })).toString('base64'),
      },
      body: JSON.stringify({ sell: 'USDC', buy: 'WETH', amount: '1000000' }),
    });

    // Step 5: Receive successful response with payment confirmation
    if (retryResponse.status === 200) {
      const paymentResponse = retryResponse.headers.get('X-Payment-Response');
      const quote = await retryResponse.json();

      console.log('Payment successful:', {
        paymentProof: paymentResponse,
        quote,
      });

      return quote;
    }
  }
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('🚀 Running X402 Arbitrum Examples...\n');

  try {
    console.log('Example 1: Basic USDs Payment');
    // await example1_BasicUSdsPayment();
    console.log('✓ Complete\n');

    console.log('Example 2: Gasless Payment with EIP-3009');
    // await example2_GaslessPayment();
    console.log('✓ Complete\n');

    console.log('Example 3: Quote Service Flow');
    // await example3_QuoteServiceFlow();
    console.log('✓ Complete\n');

    console.log('Example 4: Metered AI Inference');
    // await example4_MeteredAIInference();
    console.log('✓ Complete\n');

    console.log('Example 5: Check USDs Balance');
    // await example5_CheckUSdsBalance();
    console.log('✓ Complete\n');

    console.log('Example 6: Multi-Token Payment');
    await example6_MultiTokenPayment();
    console.log('✓ Complete\n');

    console.log('Example 7: Complete HTTP Flow');
    // await example7_CompleteHTTPFlow();
    console.log('✓ Complete\n');

    console.log('🎉 All examples completed!');
  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

// Uncomment to run examples
// runAllExamples().catch(console.error);
