#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createWalletClient, http, isAddress, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createPaymentHeader } from 'x402/client';
import { processPriceToAtomicAmount } from 'x402/shared';
import debug from 'debug';

import pkg from '../package.json' with { type: 'json' };
import { base } from 'viem/chains';

const X402_VERSION = 1;
const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const NETWORK = 'base';

// Load the environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex;
const MAX_PAYMENT_AMOUNT_USDC = process.env.MAX_PAYMENT_AMOUNT_USDC;

if (!PRIVATE_KEY) {
  throw new Error('PRIVATE_KEY is not set');
}

if (!MAX_PAYMENT_AMOUNT_USDC) {
  throw new Error('MAX_PAYMENT_AMOUNT_USDC is not set');
}

const log = debug('payflow');

const walletClient = createWalletClient({
  chain: base,
  transport: http(),
  account: privateKeyToAccount(PRIVATE_KEY),
});

const server = new McpServer({
  name: pkg.name,
  version: pkg.version,
});

server.tool(
  'create_payment',
  'Create a payment to use with paid MCP servers.',
  {
    tool: z.string().describe('The MCP tool to pay for').optional(),
    amount: z.number().max(Number(MAX_PAYMENT_AMOUNT_USDC)).describe('The payment amount in USDC'),
    recipient: z.string().refine(isAddress, { message: 'Invalid address' }).describe('The recipient of the payment'),
  },
  async ({ amount, recipient, tool }) => {
    log(`Creating payment of ${amount} to ${recipient}`);

    const atomicAmount = processPriceToAtomicAmount(amount, NETWORK);
    if ('error' in atomicAmount) {
      throw new Error(atomicAmount.error);
    }

    const { maxAmountRequired, asset } = atomicAmount;

    const header = await createPaymentHeader(walletClient as any, X402_VERSION, {
      scheme: 'exact',
      description: 'Payment for MCP server',
      network: NETWORK,
      maxAmountRequired: maxAmountRequired,
      resource: tool ?? 'unknown',
      mimeType: 'application/json',
      payTo: recipient,
      maxTimeoutSeconds: 3600,
      asset: asset.address,
      extra: {
        name: asset.eip712.name,
        version: asset.eip712.version,
      },
    });

    log(`Payment header: ${header}`);

    return {
      content: [
        {
          type: 'text',
          text: header,
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();

log('Starting MCP server transport=stdio');
await server.connect(transport);
