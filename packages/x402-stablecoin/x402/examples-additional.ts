/**
 * Additional X402 Arbitrum Examples
 * 
 * Real-world use cases for X402 payment integration:
 * - Subscription services
 * - Pay-per-call APIs
 * - Session-based access
 * - Usage-based billing
 * - Batch processing
 */

import { createArbitrumAdapter, ArbitrumX402Adapter } from './arbitrum-adapter';
import { Address } from 'viem';

// Example 8: Subscription Payment System
export async function subscriptionPaymentExample() {
  console.log('\n=== Example 8: Subscription Payment ===\n');

  const adapter = createArbitrumAdapter({
    network: 'sepolia',
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
    facilitatorUrl: 'https://facilitator.example.com',
  });

  // Monthly subscription: $10/month in USDs
  const subscriptionConfig = {
    price: '10.0',
    token: 'USDs' as const,
    recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' as Address,
    billingPeriod: 30 * 24 * 60 * 60, // 30 days in seconds
  };

  // Create recurring payment authorization
  const paymentRequest = adapter.createPaymentRequest({
    price: subscriptionConfig.price,
    recipient: subscriptionConfig.recipient,
    token: subscriptionConfig.token,
  });

  console.log('📅 Subscription Details:');
  console.log(`   Amount: $${subscriptionConfig.price} USDs/month`);
  console.log(`   Billing Period: ${subscriptionConfig.billingPeriod / (24 * 60 * 60)} days`);
  console.log(`   Next Charge: ${new Date(Date.now() + subscriptionConfig.billingPeriod * 1000).toLocaleDateString()}`);

  // Execute initial payment
  try {
    const result = await adapter.executeStandardPayment(paymentRequest);
    
    console.log('\n✅ Subscription Activated:');
    console.log(`   Transaction: ${result.txHash}`);
    console.log(`   Active Until: ${new Date(Date.now() + subscriptionConfig.billingPeriod * 1000).toLocaleDateString()}`);

    // Store subscription in database for automatic renewal
    const subscription = {
      userId: 'user123',
      plan: 'premium',
      amount: subscriptionConfig.price,
      token: subscriptionConfig.token,
      txHash: result.txHash,
      startDate: Date.now(),
      nextBilling: Date.now() + subscriptionConfig.billingPeriod * 1000,
      status: 'active',
    };

    console.log('\n📊 Subscription Record:', subscription);
    
    return subscription;
  } catch (error: any) {
    console.error('❌ Subscription failed:', error.message);
    throw error;
  }
}

// Example 9: Pay-Per-Call API Monetization
export async function payPerCallAPIExample() {
  console.log('\n=== Example 9: Pay-Per-Call API ===\n');

  const adapter = createArbitrumAdapter({
    network: 'sepolia',
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
    facilitatorUrl: 'https://facilitator.example.com',
  });

  // API pricing tiers
  const pricingTiers = {
    'gpt-4-turbo': '0.001',      // $0.001 per call
    'claude-3-opus': '0.0015',   // $0.0015 per call
    'dall-e-3': '0.002',         // $0.002 per call
    'whisper-1': '0.0005',       // $0.0005 per call
  };

  const model = 'gpt-4-turbo';
  const recipient = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' as Address;

  console.log('🤖 AI API Call:');
  console.log(`   Model: ${model}`);
  console.log(`   Price: $${pricingTiers[model]} USDs`);

  // Create payment request
  const paymentRequest = adapter.createPaymentRequest({
    price: pricingTiers[model],
    recipient,
    token: 'USDs',
  });

  // User authorizes payment (gasless)
  const userAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;
  const authorization = await adapter.createPaymentAuthorization(
    paymentRequest,
    userAddress,
    process.env.PRIVATE_KEY as `0x${string}`,
  );

  console.log('\n✅ Payment Authorization Created');

  // Execute gasless payment
  const settlementResult = await adapter.executeGaslessPayment(authorization, paymentRequest);

  console.log(`\n💰 Payment Settled: ${settlementResult.txHash}`);

  // Now make API call with payment proof
  const apiResponse = await fetch('https://api.example.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Payment': `Bearer ${settlementResult.txHash}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Hello!' }],
    }),
  });

  if (apiResponse.status === 200) {
    const data = await apiResponse.json();
    console.log('\n🎉 API Response:', data.choices[0].message.content);
  }

  return {
    txHash: settlementResult.txHash,
    model,
    price: pricingTiers[model],
  };
}

// Example 10: Session-Based Access (24-Hour Pass)
export async function sessionBasedAccessExample() {
  console.log('\n=== Example 10: 24-Hour Access Pass ===\n');

  const adapter = createArbitrumAdapter({
    network: 'sepolia',
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
    facilitatorUrl: 'https://facilitator.example.com',
  });

  const passConfig = {
    duration: 24 * 60 * 60, // 24 hours in seconds
    price: '5.0',           // $5 for 24h access
    recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' as Address,
  };

  console.log('🎫 Access Pass:');
  console.log(`   Duration: ${passConfig.duration / 3600} hours`);
  console.log(`   Price: $${passConfig.price} USDs`);

  const paymentRequest = adapter.createPaymentRequest({
    price: passConfig.price,
    recipient: passConfig.recipient,
    token: 'USDs',
  });

  // Purchase pass
  const result = await adapter.executeStandardPayment(paymentRequest);

  const expiresAt = Date.now() + passConfig.duration * 1000;

  console.log('\n✅ Access Pass Purchased:');
  console.log(`   Transaction: ${result.txHash}`);
  console.log(`   Expires: ${new Date(expiresAt).toLocaleString()}`);

  // Generate session token
  const sessionToken = Buffer.from(
    JSON.stringify({
      txHash: result.txHash,
      expiresAt,
      tier: 'premium',
    })
  ).toString('base64');

  console.log(`\n🔑 Session Token: ${sessionToken.slice(0, 40)}...`);

  return {
    txHash: result.txHash,
    sessionToken,
    expiresAt,
  };
}

// Example 11: Usage-Based Billing with Metering
export async function usageBasedBillingExample() {
  console.log('\n=== Example 11: Usage-Based Billing ===\n');

  const adapter = createArbitrumAdapter({
    network: 'sepolia',
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
    facilitatorUrl: 'https://facilitator.example.com',
  });

  // Track API usage
  const usageMetrics = {
    userId: 'user123',
    apiCalls: 150,
    tokensProcessed: 50000,
    storageGB: 2.5,
  };

  // Pricing per unit
  const pricing = {
    perAPICall: 0.0001,    // $0.0001 per API call
    perToken: 0.000002,    // $0.000002 per token
    perGB: 0.10,           // $0.10 per GB storage
  };

  // Calculate total cost
  const totalCost = (
    usageMetrics.apiCalls * pricing.perAPICall +
    usageMetrics.tokensProcessed * pricing.perToken +
    usageMetrics.storageGB * pricing.perGB
  ).toFixed(4);

  console.log('📊 Usage Summary:');
  console.log(`   API Calls: ${usageMetrics.apiCalls} × $${pricing.perAPICall} = $${(usageMetrics.apiCalls * pricing.perAPICall).toFixed(4)}`);
  console.log(`   Tokens: ${usageMetrics.tokensProcessed} × $${pricing.perToken} = $${(usageMetrics.tokensProcessed * pricing.perToken).toFixed(4)}`);
  console.log(`   Storage: ${usageMetrics.storageGB} GB × $${pricing.perGB} = $${(usageMetrics.storageGB * pricing.perGB).toFixed(4)}`);
  console.log(`\n💰 Total: $${totalCost} USDs`);

  const recipient = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' as Address;

  const paymentRequest = adapter.createPaymentRequest({
    price: totalCost,
    recipient,
    token: 'USDs',
  });

  // Execute payment
  const result = await adapter.executeStandardPayment(paymentRequest);

  console.log(`\n✅ Usage Bill Paid: ${result.txHash}`);

  // Reset usage counters
  const newBillingPeriod = {
    startDate: Date.now(),
    apiCalls: 0,
    tokensProcessed: 0,
    storageGB: 0,
    lastPayment: result.txHash,
  };

  console.log('\n📅 New Billing Period Started:', new Date().toLocaleDateString());

  return {
    txHash: result.txHash,
    amount: totalCost,
    period: newBillingPeriod,
  };
}

// Example 12: Batch Payment Processing
export async function batchPaymentExample() {
  console.log('\n=== Example 12: Batch Payment Processing ===\n');

  const adapter = createArbitrumAdapter({
    network: 'sepolia',
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
    facilitatorUrl: 'https://facilitator.example.com',
  });

  // Multiple payments to process
  const payments = [
    { recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' as Address, amount: '0.001', description: 'API Call 1' },
    { recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' as Address, amount: '0.002', description: 'API Call 2' },
    { recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' as Address, amount: '0.0015', description: 'API Call 3' },
  ];

  console.log(`📦 Processing ${payments.length} payments...\n`);

  const results = [];

  for (const [index, payment] of payments.entries()) {
    console.log(`[${index + 1}/${payments.length}] ${payment.description}: $${payment.amount} USDs`);

    const paymentRequest = adapter.createPaymentRequest({
      price: payment.amount,
      recipient: payment.recipient,
      token: 'USDs',
    });

    try {
      const result = await adapter.executeStandardPayment(paymentRequest);
      
      console.log(`   ✅ Success: ${result.txHash.slice(0, 16)}...`);
      
      results.push({
        ...payment,
        txHash: result.txHash,
        status: 'success',
      });

      // Wait between transactions to avoid nonce issues
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
      
      results.push({
        ...payment,
        error: error.message,
        status: 'failed',
      });
    }
  }

  console.log('\n📊 Batch Summary:');
  console.log(`   Total: ${payments.length} payments`);
  console.log(`   Successful: ${results.filter(r => r.status === 'success').length}`);
  console.log(`   Failed: ${results.filter(r => r.status === 'failed').length}`);

  const totalAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  console.log(`   Total Amount: $${totalAmount.toFixed(4)} USDs`);

  return results;
}

// Example 13: Tiered Pricing with Auto-Upgrade
export async function tieredPricingExample() {
  console.log('\n=== Example 13: Tiered Pricing ===\n');

  const adapter = createArbitrumAdapter({
    network: 'sepolia',
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
    facilitatorUrl: 'https://facilitator.example.com',
  });

  // Pricing tiers
  const tiers = {
    free: { price: '0', requestsPerDay: 10, name: 'Free' },
    basic: { price: '5.0', requestsPerDay: 100, name: 'Basic' },
    pro: { price: '20.0', requestsPerDay: 1000, name: 'Pro' },
    enterprise: { price: '100.0', requestsPerDay: 10000, name: 'Enterprise' },
  };

  // User's current usage
  const currentUsage = {
    tier: 'free',
    requestsToday: 15, // Exceeded free tier
  };

  console.log('📊 Current Status:');
  console.log(`   Tier: ${tiers[currentUsage.tier].name}`);
  console.log(`   Requests Today: ${currentUsage.requestsToday}/${tiers[currentUsage.tier].requestsPerDay}`);
  console.log(`   ⚠️  Limit exceeded! Upgrade required.`);

  // Recommend upgrade
  const recommendedTier = 'basic';
  console.log(`\n💡 Recommended: ${tiers[recommendedTier].name} - $${tiers[recommendedTier].price}/month`);

  const recipient = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' as Address;

  const paymentRequest = adapter.createPaymentRequest({
    price: tiers[recommendedTier].price,
    recipient,
    token: 'USDs',
  });

  // Upgrade payment
  const result = await adapter.executeStandardPayment(paymentRequest);

  console.log(`\n✅ Upgraded to ${tiers[recommendedTier].name}:`);
  console.log(`   Transaction: ${result.txHash}`);
  console.log(`   Daily Limit: ${tiers[recommendedTier].requestsPerDay} requests`);

  return {
    txHash: result.txHash,
    oldTier: currentUsage.tier,
    newTier: recommendedTier,
    newLimit: tiers[recommendedTier].requestsPerDay,
  };
}

// Example 14: Refund/Credit System
export async function refundCreditExample() {
  console.log('\n=== Example 14: Refund/Credit System ===\n');

  const adapter = createArbitrumAdapter({
    network: 'sepolia',
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
    facilitatorUrl: 'https://facilitator.example.com',
  });

  // User's payment history
  const previousPayment = {
    txHash: '0xabc123...',
    amount: '10.0',
    service: 'API Subscription',
    date: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
  };

  console.log('📋 Refund Request:');
  console.log(`   Original Payment: ${previousPayment.txHash.slice(0, 16)}...`);
  console.log(`   Amount: $${previousPayment.amount} USDs`);
  console.log(`   Service: ${previousPayment.service}`);

  // Calculate refund (pro-rated)
  const daysUsed = 7;
  const totalDays = 30;
  const refundAmount = (parseFloat(previousPayment.amount) * (totalDays - daysUsed) / totalDays).toFixed(2);

  console.log(`\n💰 Refund Calculation:`);
  console.log(`   Days Used: ${daysUsed}/${totalDays}`);
  console.log(`   Refund: $${refundAmount} USDs`);

  // Issue credit to user
  const userAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;

  const paymentRequest = adapter.createPaymentRequest({
    price: refundAmount,
    recipient: userAddress, // Sending back to user
    token: 'USDs',
  });

  const result = await adapter.executeStandardPayment(paymentRequest);

  console.log(`\n✅ Refund Issued: ${result.txHash}`);
  console.log(`   Amount: $${refundAmount} USDs`);
  console.log(`   Recipient: ${userAddress.slice(0, 10)}...`);

  return {
    refundTxHash: result.txHash,
    originalTxHash: previousPayment.txHash,
    refundAmount,
  };
}

// Run all additional examples
export async function runAdditionalExamples() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  X402 Arbitrum - Additional Examples    ║');
  console.log('╚══════════════════════════════════════════╝');

  try {
    await subscriptionPaymentExample();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await payPerCallAPIExample();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await sessionBasedAccessExample();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await usageBasedBillingExample();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await batchPaymentExample();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await tieredPricingExample();
    await new Promise(resolve => setTimeout(resolve, 1000));

    await refundCreditExample();

    console.log('\n\n✅ All additional examples completed successfully!');
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runAdditionalExamples();
}
