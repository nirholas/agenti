import { createKeyPairSignerFromBytes } from '@solana/kit';
import dotenv from 'dotenv';

// Polyfill BigInt serialization for JSON.stringify (required for Solana transactions)
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import { x402Client } from '@x402/core/client';
import { x402HTTPClient } from '@x402/core/http';
import { registerExactSvmScheme } from '@x402/svm/exact/client';
import type { PaymentPayload, PaymentRequirements } from '@x402/core/types';
import { Message, Task } from './x402Types.js';

dotenv.config();

const AGENT_URL = process.env.AGENT_URL || 'http://localhost:3000';
const SOLANA_CLIENT_PRIVATE_KEY = process.env.SOLANA_CLIENT_PRIVATE_KEY;

interface AgentResponse {
  success?: boolean;
  task?: Task;
  events?: Task[];
  error?: string;
  x402?: any;
  settlement?: any;
}

/**
 * Parse payment errors and provide helpful, actionable error messages.
 */
function parsePaymentError(error: unknown): {
  message: string;
  suggestion: string;
  code: string;
} {
  const errorStr = error instanceof Error ? error.message : String(error);
  const errorJson = JSON.stringify(error);
  
  // Solana-specific errors
  if (errorStr.includes('InvalidAccountData') || errorJson.includes('InvalidAccountData')) {
    return {
      code: 'INVALID_ACCOUNT_DATA',
      message: 'One or more Solana accounts are not properly initialized',
      suggestion: `🔧 FIX: One of the wallets is missing a USDC token account (ATA).
   
   Check these accounts:
   1. Your client wallet - needs USDC ATA + USDC balance + SOL for rent
   2. Merchant wallet (payTo) - needs USDC ATA
   3. Facilitator wallet - needs USDC ATA + SOL for fees
   
   To create a USDC ATA on devnet:
     spl-token create-account EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v --owner <WALLET_ADDRESS>
   
   Or use: https://spl-token-faucet.com for devnet USDC`,
    };
  }

  if (errorStr.includes('InsufficientFunds') || errorStr.includes('insufficient lamports') || 
      (errorStr.includes('Insufficient') && errorStr.includes('SOL'))) {
    return {
      code: 'INSUFFICIENT_SOL',
      message: 'Not enough SOL for transaction fees',
      suggestion: `🔧 FIX: Your wallet or the facilitator needs more SOL.
   
   For devnet, get SOL from: https://faucet.solana.com
   For mainnet, you need to purchase SOL.
   
   Recommended: At least 0.01 SOL for transaction fees.`,
    };
  }

  if (errorStr.includes('insufficient funds') || errorStr.includes('exceeds balance') ||
      errorStr.includes('Insufficient USDC') || errorStr.includes('insufficient token')) {
    return {
      code: 'INSUFFICIENT_USDC',
      message: 'Not enough USDC tokens for the payment',
      suggestion: `🔧 FIX: Your wallet doesn't have enough USDC.
   
   For devnet USDC:
     - Use spl-token-faucet.com to get test USDC
     - Or manually mint devnet USDC tokens
   
   For mainnet: Purchase USDC and transfer to your wallet.`,
    };
  }

  if (errorStr.includes('AccountNotFound') || errorStr.includes('account not found')) {
    return {
      code: 'ACCOUNT_NOT_FOUND',
      message: 'Required account does not exist on-chain',
      suggestion: `🔧 FIX: Your wallet account doesn't exist on the network.
   
   For a new wallet, you need to:
   1. Fund it with some SOL first (this creates the account)
   2. Create the USDC token account
   
   For devnet: https://faucet.solana.com`,
    };
  }

  if (errorStr.includes('simulation failed') || errorStr.includes('transaction_simulation_failed')) {
    // Try to extract more specific error from simulation
    const instructionErrorMatch = errorJson.match(/InstructionError.*?"(\w+)"/);
    if (instructionErrorMatch) {
      const innerError = instructionErrorMatch[1];
      const innerResult = parsePaymentError(new Error(innerError));
      if (innerResult.code !== 'UNKNOWN_ERROR') {
        return innerResult;
      }
    }
    
    return {
      code: 'SIMULATION_FAILED',
      message: 'Transaction simulation failed before sending',
      suggestion: `🔧 FIX: The transaction would fail if sent. Common causes:
   
   1. Missing token accounts (ATAs) on any of the wallets
   2. Insufficient USDC balance in your wallet
   3. Insufficient SOL for fees in facilitator wallet
   4. Invalid transaction parameters
   
   Check all wallet balances and token accounts.`,
    };
  }

  // Generic fallback
  return {
    code: 'UNKNOWN_ERROR',
    message: errorStr,
    suggestion: 'Check the error details above for more information.',
  };
}

// Base58 alphabet used by Solana
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Decode a base58 string to bytes
 */
function decodeBase58(str: string): Uint8Array {
  const bytes: number[] = [];
  
  for (const char of str) {
    let carry = BASE58_ALPHABET.indexOf(char);
    if (carry === -1) {
      throw new Error(`Invalid base58 character: ${char}`);
    }
    
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  
  // Handle leading zeros
  for (const char of str) {
    if (char !== '1') break;
    bytes.push(0);
  }
  
  return new Uint8Array(bytes.reverse());
}

/**
 * Decodes a Solana private key from various formats
 * Supports: base58, base64, hex, and JSON array formats
 */
async function decodePrivateKey(key: string): Promise<Uint8Array> {
  // Try JSON array format first (e.g., from solana-keygen)
  if (key.startsWith('[')) {
    try {
      const arr = JSON.parse(key);
      return new Uint8Array(arr);
    } catch {
      // Not valid JSON, try other formats
    }
  }

  // Try hex format (64 or 128 characters)
  if (/^[0-9a-fA-F]{64,128}$/.test(key)) {
    const bytes = [];
    for (let i = 0; i < key.length; i += 2) {
      bytes.push(parseInt(key.substr(i, 2), 16));
    }
    return new Uint8Array(bytes);
  }

  // Try base58 format (common Solana format)
  try {
    return decodeBase58(key);
  } catch {
    // Not base58, try base64
  }

  // Try base64 format
  try {
    const binary = atob(key);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    throw new Error('Unable to decode private key. Supported formats: base58, base64, hex, JSON array');
  }
}

function selectPaymentRequirement(paymentRequired: any): PaymentRequirements {
  const accepts = paymentRequired?.accepts;
  if (!Array.isArray(accepts) || accepts.length === 0) {
    throw new Error('No payment requirements provided by the agent');
  }
  
  // Find a Solana payment requirement
  const solanaReq = accepts.find((req: PaymentRequirements) => 
    req.network.startsWith('solana:')
  );
  
  if (!solanaReq) {
    throw new Error('No Solana payment option available. Available networks: ' + 
      accepts.map((r: PaymentRequirements) => r.network).join(', '));
  }
  
  return solanaReq as PaymentRequirements;
}

/**
 * Creates a payment payload using the x402 SVM scheme
 */
async function createPaymentPayload(
  paymentRequired: any,
  x402Client: x402HTTPClient
): Promise<PaymentPayload> {
  const requirement = selectPaymentRequirement(paymentRequired);
  
  console.log(`🔐 Creating Solana payment for network: ${requirement.network}`);
  console.log(`   Asset: ${requirement.asset}`);
  console.log(`   Amount: ${requirement.amount}`);
  console.log(`   Pay to: ${requirement.payTo}`);

  // Use x402 client to create the payment payload
  const payloadResult = await x402Client.createPaymentPayload({
    x402Version: paymentRequired.x402Version ?? 2,
    accepts: [requirement],
    resource: paymentRequired.resource,
  });

  return payloadResult as PaymentPayload;
}

/**
 * Solana Test client that can interact with the x402 AI agent
 * This demonstrates the complete payment flow using x402 v2 with Solana
 */
export class SolanaTestClient {
  private x402Client?: x402HTTPClient;
  private agentUrl: string;
  private walletAddress?: string;

  constructor(agentUrl: string = AGENT_URL) {
    this.agentUrl = agentUrl;
  }

  /**
   * Initialize the client with a Solana private key
   */
  async initialize(privateKey: string): Promise<void> {
    const keyBytes = await decodePrivateKey(privateKey);
    
    // Solana keypairs are 64 bytes (32 secret + 32 public)
    // Some formats only provide the 32-byte secret
    let fullKeyBytes: Uint8Array;
    if (keyBytes.length === 32) {
      // Need to derive the full keypair - for now, require full 64-byte keypair
      throw new Error('Please provide a full 64-byte Solana keypair (not just the 32-byte secret key)');
    } else if (keyBytes.length === 64) {
      fullKeyBytes = keyBytes;
    } else {
      throw new Error(`Invalid key length: ${keyBytes.length}. Expected 64 bytes.`);
    }

    const signer = await createKeyPairSignerFromBytes(fullKeyBytes);
    this.walletAddress = signer.address;
    
    console.log(`💼 Solana wallet: ${this.walletAddress}`);

    // Initialize x402 v2 client with SVM scheme
    const coreClient = new x402Client();
    registerExactSvmScheme(coreClient, { signer });
    
    this.x402Client = new x402HTTPClient(coreClient);
  }

  /**
   * Send a request to the agent
   */
  async sendRequest(text: string): Promise<AgentResponse> {
    const message: Message = {
      messageId: `msg-${Date.now()}`,
      role: 'user',
      parts: [
        {
          kind: 'text',
          text: text,
        },
      ],
    };

    console.log(`\n📤 Sending request: "${text}"`);

    const response = await fetch(`${this.agentUrl}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    const data = await response.json() as any;

    // Check for A2A-style payment requirement in task metadata
    if (data.task?.status?.message?.metadata?.['x402.payment.required']) {
      console.log('💳 Payment required (A2A style with x402 v2)!');
      return {
        error: 'Payment Required',
        x402: data.task.status.message.metadata['x402.payment.required'],
        task: data.task
      };
    }

    // Check for HTTP 402 style (legacy)
    if (response.status === 402) {
      console.log('💳 Payment required (HTTP 402)!');
      return { error: 'Payment Required', x402: data.x402 };
    }

    return data as AgentResponse;
  }

  /**
   * Send a paid request (with Solana payment)
   */
  async sendPaidRequest(text: string): Promise<AgentResponse> {
    if (!this.x402Client) {
      throw new Error('Client not initialized. Call initialize() first with a Solana private key.');
    }

    // Step 1: Send initial request
    console.log('\n=== STEP 1: Initial Request ===');
    const initialResponse = await this.sendRequest(text);

    if (!initialResponse.x402) {
      console.log('✅ Request processed without payment (unexpected)');
      return initialResponse;
    }

    // Step 2: Process payment requirement
    console.log('\n=== STEP 2: Processing Solana Payment (x402 v2) ===');
    const paymentRequired = initialResponse.x402;
    console.log(`x402 Version: ${paymentRequired.x402Version || 2}`);
    console.log(`Payment options: ${paymentRequired.accepts.length}`);
    
    // Find Solana option
    const solanaOption = paymentRequired.accepts.find((r: PaymentRequirements) => 
      r.network.startsWith('solana:')
    );
    
    if (!solanaOption) {
      console.log('❌ No Solana payment option available');
      console.log('Available networks:', paymentRequired.accepts.map((r: PaymentRequirements) => r.network).join(', '));
      throw new Error('Server does not accept Solana payments');
    }
    
    console.log(`Solana option: ${solanaOption.asset} on ${solanaOption.network}`);
    console.log(`Amount: ${solanaOption.amount} (atomic units)`);

    try {
      // Process the payment (sign transaction)
      console.log('🔐 Creating Solana payment transaction...');
      const paymentPayload = await createPaymentPayload(paymentRequired, this.x402Client);
      console.log('✅ Payment transaction created successfully');

      // Step 3: Submit payment with original message
      console.log('\n=== STEP 3: Submitting Payment ===');

      // Use the taskId and contextId from the initial response if available
      const taskId = (initialResponse as any).task?.id || `task-${Date.now()}`;
      const contextId = (initialResponse as any).task?.contextId || `context-${Date.now()}`;

      // Create message with payment metadata embedded
      const message: Message = {
        messageId: `msg-${Date.now()}`,
        role: 'user',
        parts: [
          {
            kind: 'text',
            text: text,
          },
        ],
        metadata: {
          'x402.payment.payload': paymentPayload,
          'x402.payment.status': 'payment-submitted',
        },
      };

      const paidResponse = await fetch(`${this.agentUrl}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          taskId: taskId,
          contextId: contextId,
        }),
      });

      const paidData = await paidResponse.json() as any;

      if (paidResponse.ok) {
        console.log('✅ Solana payment accepted and request processed!');
        return paidData as AgentResponse;
      } else {
        // Parse the error for helpful messages
        const errorMessage = paidData.error || paidData.suggestion || 'Unknown error';
        const parsed = parsePaymentError(new Error(errorMessage));
        
        console.log(`\n❌ Payment failed:`);
        console.log(`   Code: ${paidData.code || parsed.code}`);
        console.log(`   Message: ${paidData.error || parsed.message}`);
        if (paidData.suggestion) {
          console.log(`\n${paidData.suggestion}`);
        } else if (parsed.code !== 'UNKNOWN_ERROR') {
          console.log(`\n${parsed.suggestion}`);
        }
        
        return paidData as AgentResponse;
      }
    } catch (error) {
      const parsed = parsePaymentError(error);
      console.error(`\n❌ Error processing Solana payment:`);
      console.error(`   Code: ${parsed.code}`);
      console.error(`   Message: ${parsed.message}`);
      if (parsed.code !== 'UNKNOWN_ERROR') {
        console.error(`\n${parsed.suggestion}`);
      }
      throw error;
    }
  }

  /**
   * Check agent health
   */
  async checkHealth(): Promise<any> {
    console.log('\n🏥 Checking agent health...');
    const response = await fetch(`${this.agentUrl}/health`);
    const data = await response.json() as any;

    if (response.ok) {
      console.log('✅ Agent is healthy');
      console.log(`   Service: ${data.service}`);
      console.log(`   Version: ${data.version}`);
      console.log(`   x402 Version: ${data.x402Version || 'unknown'}`);
      console.log(`   Payment address: ${data.payment.address}`);
      console.log(`   Network: ${data.payment.network}`);
      console.log(`   Price: ${data.payment.price}`);
    } else {
      console.log('❌ Agent is not healthy');
    }

    return data;
  }
}

/**
 * Main test function that demonstrates the x402 v2 payment flow with Solana.
 * 
 * This function runs two tests:
 * 1. Sends a request without payment to verify the agent returns payment requirements
 * 2. If a Solana wallet is configured, sends a paid request by:
 *    - Creating a signed Solana transaction for USDC transfer
 *    - Submitting the payment payload with the request
 *    - Receiving and displaying the AI agent's response after payment verification
 * 
 * The function showcases the complete x402 v2 protocol flow with Solana from payment
 * requirement discovery through payment submission and settlement.
 */
async function main() {
  console.log('🧪 x402 v2 Solana AI Agent Test Client');
  console.log('======================================\n');

  const client = new SolanaTestClient();

  // Check agent health
  await client.checkHealth();

  // Test 1: Request without payment
  console.log('\n\n📋 TEST 1: Request without payment');
  console.log('=====================================');
  try {
    const response = await client.sendRequest('What is 2+2?');
    if (response.x402) {
      console.log('✅ Correctly received payment requirement (x402 v2)');
      console.log(`   x402 Version: ${response.x402.x402Version || 'unknown'}`);
      
      // Check if Solana is supported
      const solanaOption = response.x402.accepts?.find((r: PaymentRequirements) => 
        r.network.startsWith('solana:')
      );
      if (solanaOption) {
        console.log(`   ✅ Solana payment option available: ${solanaOption.network}`);
      } else {
        console.log('   ⚠️  No Solana payment option - server may be configured for EVM only');
      }
    } else {
      console.log('❌ Expected payment requirement');
    }
  } catch (error) {
    console.error('❌ Test 1 failed:', error);
  }

  // Test 2: Request with Solana payment (only if wallet configured)
  if (SOLANA_CLIENT_PRIVATE_KEY) {
    console.log('\n\n📋 TEST 2: Request with Solana payment');
    console.log('========================================');
    try {
      await client.initialize(SOLANA_CLIENT_PRIVATE_KEY);
      
      const response = await client.sendPaidRequest('Tell me a joke about Solana!');

      if (response.success && response.task) {
        console.log('\n🎉 SUCCESS! Response from AI:');
        console.log('-----------------------------------');
        const aiResponse = response.task.status.message?.parts
          ?.filter((p: any) => p.kind === 'text')
          .map((p: any) => p.text)
          .join(' ');
        console.log(aiResponse);
        console.log('-----------------------------------');
        
        if (response.settlement?.transaction) {
          console.log(`\n💰 Payment settled on Solana!`);
          console.log(`   Transaction: ${response.settlement.transaction}`);
          console.log(`   Network: ${response.settlement.network}`);
        }
      } else {
        console.log('❌ Request failed:', response.error);
      }
    } catch (error) {
      console.error('❌ Test 2 failed:', error);
    }
  } else {
    console.log('\n\n⚠️  TEST 2: Skipped (no SOLANA_CLIENT_PRIVATE_KEY configured)');
    console.log('========================================');
    console.log('To test with Solana payment, set SOLANA_CLIENT_PRIVATE_KEY in .env');
    console.log('You can generate a keypair with: solana-keygen new');
    console.log('This wallet needs:');
    console.log('  - USDC tokens (devnet or mainnet)');
    console.log('  - SOL for transaction fees');
    console.log('\nSupported key formats:');
    console.log('  - Base58 encoded (default Solana format)');
    console.log('  - JSON array (from solana-keygen)');
    console.log('  - Base64 encoded');
    console.log('  - Hex encoded');
  }

  console.log('\n\n✅ Tests complete!');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as runSolanaTests };

