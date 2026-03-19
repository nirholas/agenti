import { randomBytes } from 'crypto';
import { Wallet } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const CLIENT_PRIVATE_KEY = process.env.CLIENT_PRIVATE_KEY;
const PAY_TO_ADDRESS = process.env.PAY_TO_ADDRESS;
const NETWORK = process.env.NETWORK || 'base-sepolia';

const TRANSFER_AUTH_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

const CHAIN_IDS = {
  base: 8453,
  'base-sepolia': 84532,
  ethereum: 1,
  polygon: 137,
  'polygon-amoy': 80002,
};

function selectPaymentRequirement(paymentRequired) {
  if (!Array.isArray(paymentRequired?.accepts) || paymentRequired.accepts.length === 0) {
    throw new Error('No payment requirements provided');
  }
  return paymentRequired.accepts[0];
}

function generateNonce() {
  return `0x${randomBytes(32).toString('hex')}`;
}

function getChainId(network) {
  const chainId = CHAIN_IDS[network];
  if (!chainId) {
    throw new Error(`Unsupported network "${network}"`);
  }
  return chainId;
}

async function createPaymentPayload(paymentRequired, wallet) {
  const requirement = selectPaymentRequirement(paymentRequired);
  const now = Math.floor(Date.now() / 1000);

  const authorization = {
    from: wallet.address,
    to: requirement.payTo,
    value: requirement.maxAmountRequired,
    validAfter: '0',
    validBefore: String(now + requirement.maxTimeoutSeconds),
    nonce: generateNonce(),
  };

  const domain = {
    name: requirement.extra?.name || 'USDC',
    version: requirement.extra?.version || '2',
    chainId: getChainId(requirement.network),
    verifyingContract: requirement.asset,
  };

  const signature = await wallet.signTypedData(domain, TRANSFER_AUTH_TYPES, authorization);

  return {
    x402Version: paymentRequired.x402Version ?? 1,
    scheme: requirement.scheme,
    network: requirement.network,
    payload: {
      signature,
      authorization,
    },
  };
}

async function testFacilitator() {
  console.log('🧪 Testing Facilitator Communication');
  console.log('====================================\n');

  if (!CLIENT_PRIVATE_KEY) {
    console.error('❌ CLIENT_PRIVATE_KEY not set');
    return;
  }

  const wallet = new Wallet(CLIENT_PRIVATE_KEY);
  console.log(`💼 Client wallet: ${wallet.address}`);
  console.log(`💰 Merchant wallet: ${PAY_TO_ADDRESS}`);
  console.log(`🌐 Network: ${NETWORK}\n`);

  // Create a payment requirement
  const paymentRequired = {
    x402Version: 1,
    accepts: [{
      scheme: 'exact',
      network: NETWORK,
      asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC on Base Sepolia
      payTo: PAY_TO_ADDRESS,
      maxAmountRequired: '100000', // $0.10
      resource: '/test-resource',
      description: 'Test payment',
      mimeType: 'application/json',
      maxTimeoutSeconds: 600,
      extra: {
        name: 'USDC',
        version: '2',
      },
    }],
    error: 'Payment required',
  };

  console.log('📝 Payment requirements:');
  console.log(JSON.stringify(paymentRequired, null, 2));

  // Sign the payment
  console.log('\n🔐 Signing payment...');
  const paymentPayload = await createPaymentPayload(paymentRequired, wallet);

  console.log('\n✅ Payment signed!');
  console.log('Payment payload:');
  console.log(JSON.stringify(paymentPayload, null, 2));

  // Try to verify with the facilitator
  console.log('\n📡 Sending verification request to facilitator...');
  console.log('URL: https://x402.org/facilitator/verify\n');

  try {
    const verifyResponse = await fetch('https://x402.org/facilitator/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payment: paymentPayload,
        requirements: paymentRequired.accepts[0],
      }),
    });

    console.log(`Response status: ${verifyResponse.status} ${verifyResponse.statusText}`);

    const responseText = await verifyResponse.text();
    console.log('\nResponse body:');
    console.log(responseText);

    if (verifyResponse.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log('\n✅ Parsed response:');
        console.log(JSON.stringify(data, null, 2));
      } catch (e) {
        // Response is not JSON
      }
    } else {
      console.log('\n❌ Facilitator returned an error');

      // Try to parse error details
      try {
        const errorData = JSON.parse(responseText);
        console.log('\nError details:');
        console.log(JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.log('\nRaw error response (not JSON):');
        console.log(responseText);
      }
    }

  } catch (error) {
    console.error('\n❌ Error communicating with facilitator:', error);
  }

  // Also try the settle endpoint to see its format
  console.log('\n\n📡 Testing settle endpoint...');
  console.log('URL: https://x402.org/facilitator/settle\n');

  try {
    const settleResponse = await fetch('https://x402.org/facilitator/settle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payment: paymentPayload,
        requirements: paymentRequired.accepts[0],
      }),
    });

    console.log(`Response status: ${settleResponse.status} ${settleResponse.statusText}`);

    const responseText = await settleResponse.text();
    console.log('\nResponse body:');
    console.log(responseText);

  } catch (error) {
    console.error('\n❌ Error communicating with facilitator:', error);
  }
}

testFacilitator().catch(console.error);
