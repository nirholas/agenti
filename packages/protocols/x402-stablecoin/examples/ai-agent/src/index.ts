/**
 * AI Agent X402 Payment Example
 * 
 * Demonstrates an AI agent (Claude) making autonomous X402 payments
 * to access paid APIs and services.
 */

import Anthropic from '@anthropic-ai/sdk';

// ============================================
// Type Definitions for v0.20.x SDK
// ============================================

/* eslint-disable @typescript-eslint/no-explicit-any */
type MessageParam = any;
type ContentBlock = any;
type Message = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

interface TextBlock {
  type: 'text';
  text: string;
}

// ============================================
// X402 Tool Definitions
// ============================================

const x402Tools: Tool[] = [
  {
    name: 'check_balance',
    description: 'Check USDs balance and yield earned for your wallet',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'make_payment',
    description: 'Make an X402 payment using USDs. Use this when you need to pay for an API or service.',
    input_schema: {
      type: 'object' as const,
      properties: {
        recipient: {
          type: 'string',
          description: 'The recipient address for the payment',
        },
        amount: {
          type: 'string',
          description: 'The amount to pay in USDs (e.g., "0.01" for 1 cent)',
        },
        reason: {
          type: 'string',
          description: 'Why this payment is being made',
        },
      },
      required: ['recipient', 'amount', 'reason'],
    },
  },
  {
    name: 'call_paid_api',
    description: 'Call a paid API that requires X402 payment. The tool will automatically handle payment if needed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        endpoint: {
          type: 'string',
          description: 'The API endpoint to call',
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST'],
          description: 'HTTP method',
        },
        body: {
          type: 'string',
          description: 'Request body for POST requests',
        },
      },
      required: ['endpoint', 'method'],
    },
  },
];

// ============================================
// Tool Handlers
// ============================================

async function handleToolCall(
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<string> {
  switch (toolName) {
    case 'check_balance':
      // Simulate balance check
      return JSON.stringify({
        balance: '100.00',
        yieldEarned: '2.50',
        apy: '10.2%',
        currency: 'USDs',
      });

    case 'make_payment':
      // Simulate payment
      console.log(`\n💸 Making payment: ${toolInput.amount} USDs to ${toolInput.recipient}`);
      console.log(`   Reason: ${toolInput.reason}`);
      return JSON.stringify({
        success: true,
        txHash: '0x' + Math.random().toString(16).slice(2, 66),
        amount: toolInput.amount,
        recipient: toolInput.recipient,
      });

    case 'call_paid_api':
      // Simulate API call with X402 payment flow
      const endpoint = toolInput.endpoint as string;
      console.log(`\n🌐 Calling API: ${endpoint}`);

      // Simulate 402 response
      if (Math.random() > 0.3) {
        console.log('   Received 402 Payment Required');
        return JSON.stringify({
          status: 402,
          paymentRequired: {
            recipient: '0x' + Math.random().toString(16).slice(2, 42),
            amount: '0.001',
            currency: 'USDs',
            description: 'API call fee',
          },
        });
      } else {
        return JSON.stringify({
          status: 200,
          data: { result: 'API response data' },
        });
      }

    default:
      return JSON.stringify({ error: 'Unknown tool' });
  }
}

// ============================================
// Main Agent Loop
// ============================================

async function runAgent() {
  console.log('🤖 AI Agent X402 Payment Demo\n');
  console.log('This demo shows how an AI agent can autonomously manage payments.\n');

  // Check if API key is available
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('⚠️  No ANTHROPIC_API_KEY found. Running in simulation mode.\n');
    runSimulation();
    return;
  }

  const client = new Anthropic({ apiKey });

  const messages: MessageParam[] = [
    {
      role: 'user',
      content: `You are an AI agent with a USDs wallet for making X402 payments. 
      
      First, check your balance. Then try to call a paid API endpoint at 
      "https://api.example.com/premium-data". If you receive a 402 Payment Required 
      response, make the required payment and then try again.
      
      Report what you did and the results.`,
    },
  ];

  let response: Message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages,
  });

  // Agent loop - handle tool calls
  while (response.stop_reason === 'tool_use') {
    const toolUse = response.content.find(
      (block: ContentBlock): boolean => block.type === 'tool_use'
    ) as ToolUseBlock | undefined;

    if (!toolUse) break;

    console.log(`\n🔧 Agent using tool: ${toolUse.name}`);

    const result = await handleToolCall(
      toolUse.name,
      toolUse.input as Record<string, unknown>
    );

    messages.push({ role: 'assistant', content: response.content as ContentBlock[] });
    messages.push({
      role: 'user',
      content: [
        {
          type: 'tool_result' as const,
          tool_use_id: toolUse.id,
          content: result,
        } as unknown as ContentBlock,
      ],
    });

    response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages,
    });
  }

  // Print final response
  const textBlock = response.content.find(
    (block: ContentBlock): boolean => block.type === 'text'
  ) as TextBlock | undefined;

  console.log('\n📋 Agent Report:\n');
  console.log(textBlock?.text || 'No response');
}

// ============================================
// Simulation Mode (no API key)
// ============================================

function runSimulation() {
  console.log('=== Simulation Mode ===\n');

  console.log('1. Agent checks balance...');
  console.log('   Balance: $100.00 USDs');
  console.log('   Yield Earned: $2.50');
  console.log('   APY: 10.2%\n');

  console.log('2. Agent calls paid API...');
  console.log('   Response: 402 Payment Required');
  console.log('   Amount: $0.001 USDs\n');

  console.log('3. Agent makes X402 payment...');
  console.log('   ✅ Payment confirmed');
  console.log('   TxHash: 0x1234...abcd\n');

  console.log('4. Agent retries API call...');
  console.log('   ✅ Success! API returned data.\n');

  console.log('=== End Simulation ===\n');
  console.log('To run with real AI, set ANTHROPIC_API_KEY environment variable.');
}

// Run the agent
runAgent().catch(console.error);
