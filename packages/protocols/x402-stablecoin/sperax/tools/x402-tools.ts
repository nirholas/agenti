/**
 * Sperax X402 MCP Tools
 * 
 * Model Context Protocol tools for AI agents to interact with
 * X402 payment protocol using Sperax USDs on Arbitrum.
 */

import { ethers } from 'ethers';
import { SperaxClient, SPERAX_ADDRESSES } from '../services/sperax';

// Balance with yield info
export interface BalanceWithYield {
  balance: string;
  yieldEarned: string;
  apy: string;
  isRebasing: boolean;
}

// ============================================
// Tool Definitions (MCP Schema)
// ============================================

export const speraxToolDefinitions = {
  x402_check_usds_balance: {
    name: 'x402_check_usds_balance',
    description: 'Check USDs balance and earned yield for an address. Returns current balance, yield earned, and APY.',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Ethereum address to check balance for'
        }
      },
      required: ['address']
    }
  },

  x402_pay_with_usds: {
    name: 'x402_pay_with_usds',
    description: 'Make an X402 payment using USDs stablecoin. Supports both standard and gasless (EIP-3009) payments.',
    inputSchema: {
      type: 'object',
      properties: {
        recipient: {
          type: 'string',
          description: 'Recipient address for the payment'
        },
        amount: {
          type: 'string',
          description: 'Amount in USDs to pay (e.g., "1.50" for $1.50)'
        },
        gasless: {
          type: 'boolean',
          description: 'Whether to use gasless EIP-3009 transfer (default: false)'
        },
        memo: {
          type: 'string',
          description: 'Optional memo/description for the payment'
        }
      },
      required: ['recipient', 'amount']
    }
  },

  x402_create_payment_authorization: {
    name: 'x402_create_payment_authorization',
    description: 'Create a signed EIP-3009 authorization for gasless X402 payment. Returns signature for facilitator submission.',
    inputSchema: {
      type: 'object',
      properties: {
        recipient: {
          type: 'string',
          description: 'Recipient address for the payment'
        },
        amount: {
          type: 'string',
          description: 'Amount in USDs to authorize'
        },
        validUntil: {
          type: 'number',
          description: 'Unix timestamp when authorization expires (default: 1 hour)'
        }
      },
      required: ['recipient', 'amount']
    }
  },

  x402_get_yield_stats: {
    name: 'x402_get_yield_stats',
    description: 'Get current USDs yield statistics including APY, vault TVL, and rebase info.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  x402_estimate_payment_cost: {
    name: 'x402_estimate_payment_cost',
    description: 'Estimate the cost of an X402 payment including gas fees.',
    inputSchema: {
      type: 'object',
      properties: {
        recipient: {
          type: 'string',
          description: 'Recipient address'
        },
        amount: {
          type: 'string',
          description: 'Payment amount in USDs'
        },
        gasless: {
          type: 'boolean',
          description: 'Whether to estimate gasless payment'
        }
      },
      required: ['recipient', 'amount']
    }
  },

  x402_verify_payment: {
    name: 'x402_verify_payment',
    description: 'Verify an X402 payment was completed successfully.',
    inputSchema: {
      type: 'object',
      properties: {
        transactionHash: {
          type: 'string',
          description: 'Transaction hash to verify'
        }
      },
      required: ['transactionHash']
    }
  }
};

// ============================================
// RPC URLs
// ============================================

const RPC_URLS: Record<string, string> = {
  mainnet: 'https://arb1.arbitrum.io/rpc',
  sepolia: 'https://sepolia-rollup.arbitrum.io/rpc',
  bsc: 'https://bsc-dataseed1.binance.org'  // BSC for Sperax
};

// ============================================
// Tool Handler Class
// ============================================

export interface SperaxToolConfig {
  privateKey?: string;
  rpcUrl?: string;
  network?: 'mainnet' | 'sepolia' | 'bsc';
  facilitatorUrl?: string;
}

export class SperaxX402Tools {
  private speraxClient: SperaxClient;
  private provider: ethers.JsonRpcProvider;
  private wallet?: ethers.Wallet;
  private config: SperaxToolConfig;

  constructor(config: SperaxToolConfig = {}) {
    this.config = {
      network: 'bsc',  // Sperax is on BSC
      facilitatorUrl: 'http://localhost:3002',
      ...config
    };

    const rpcUrl = this.config.rpcUrl || RPC_URLS[this.config.network || 'bsc'];
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    if (this.config.privateKey) {
      this.wallet = new ethers.Wallet(this.config.privateKey, this.provider);
      this.speraxClient = new SperaxClient(this.provider, this.wallet);
    } else {
      this.speraxClient = new SperaxClient(this.provider);
    }
  }

  /**
   * Execute a tool by name
   */
  async executeTool(toolName: string, params: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
      case 'x402_check_usds_balance':
        return this.checkBalance(params.address as string);

      case 'x402_pay_with_usds':
        return this.payWithUSDs(
          params.recipient as string,
          params.amount as string,
          params.gasless as boolean,
          params.memo as string
        );

      case 'x402_create_payment_authorization':
        return this.createPaymentAuthorization(
          params.recipient as string,
          params.amount as string,
          params.validUntil as number
        );

      case 'x402_get_yield_stats':
        return this.getYieldStats();

      case 'x402_estimate_payment_cost':
        return this.estimatePaymentCost(
          params.recipient as string,
          params.amount as string,
          params.gasless as boolean
        );

      case 'x402_verify_payment':
        return this.verifyPayment(params.transactionHash as string);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Check USDs balance and yield for an address
   */
  async checkBalance(address: string): Promise<BalanceWithYield> {
    const position = await this.speraxClient.getUserPosition(address);
    const apy = await this.speraxClient.getCurrentAPY();
    
    return {
      balance: position.usDsBalance,
      yieldEarned: position.estimatedYield,
      apy: apy,
      isRebasing: position.isRebasing
    };
  }

  /**
   * Make a payment with USDs
   */
  async payWithUSDs(
    recipient: string,
    amount: string,
    gasless: boolean = false,
    memo?: string
  ): Promise<{ txHash: string; status: string; memo?: string }> {
    if (!this.wallet) {
      throw new Error('No private key configured. Cannot make payments.');
    }

    if (gasless) {
      // Create and submit gasless authorization
      const auth = await this.createPaymentAuthorization(recipient, amount);
      
      // Submit to facilitator
      const response = await globalThis.fetch(`${this.config.facilitatorUrl}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorization: auth,
          memo
        })
      });

      if (!response.ok) {
        throw new Error(`Facilitator error: ${await response.text()}`);
      }

      const result = await response.json() as { transactionHash: string };
      return {
        txHash: result.transactionHash,
        status: 'settled',
        memo
      };
    } else {
      // Standard transfer
      const txHash = await this.speraxClient.transferUSDs(recipient, amount);
      return {
        txHash,
        status: 'confirmed',
        memo
      };
    }
  }

  /**
   * Create EIP-3009 payment authorization
   * Note: This creates a signature for gasless transfer
   */
  async createPaymentAuthorization(
    recipient: string,
    amount: string,
    validUntil?: number
  ): Promise<{
    from: string;
    to: string;
    value: string;
    validAfter: number;
    validBefore: number;
    nonce: string;
    signature: string;
  }> {
    if (!this.wallet) {
      throw new Error('No private key configured. Cannot create authorization.');
    }

    const amountWei = ethers.parseEther(amount);
    const now = Math.floor(Date.now() / 1000);
    const validAfter = now - 60; // Valid from 1 minute ago
    const validBefore = validUntil || now + 3600; // Valid for 1 hour by default
    const nonce = ethers.hexlify(ethers.randomBytes(32));

    // EIP-3009 TypedData
    const domain = {
      name: 'USDs',
      version: '1',
      chainId: 56, // BSC
      verifyingContract: SPERAX_ADDRESSES.USDS
    };

    const types = {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' }
      ]
    };

    const message = {
      from: this.wallet.address,
      to: recipient,
      value: amountWei,
      validAfter,
      validBefore,
      nonce
    };

    const signature = await this.wallet.signTypedData(domain, types, message);

    return {
      from: this.wallet.address,
      to: recipient,
      value: amountWei.toString(),
      validAfter,
      validBefore,
      nonce,
      signature
    };
  }

  /**
   * Get current yield statistics
   */
  async getYieldStats(): Promise<{
    apy: string;
    tvl: string;
    lastRebase: string;
    collateralRatio: string;
  }> {
    const apy = await this.speraxClient.getCurrentAPY();
    const vaultInfo = await this.speraxClient.getVaultInfo();
    
    return {
      apy: apy,
      tvl: `$${vaultInfo.totalCollateralValue} USD`,
      lastRebase: new Date().toISOString(),
      collateralRatio: vaultInfo.collateralRatio
    };
  }

  /**
   * Estimate payment cost
   */
  async estimatePaymentCost(
    _recipient: string,
    amount: string,
    gasless: boolean = false
  ): Promise<{
    paymentAmount: string;
    estimatedGas: string;
    estimatedGasCost: string;
    totalCost: string;
    savings: string;
  }> {
    if (gasless) {
      return {
        paymentAmount: amount,
        estimatedGas: '0',
        estimatedGasCost: '0',
        totalCost: amount,
        savings: 'Gas paid by facilitator'
      };
    }

    // Estimate gas for standard transfer (~65,000 gas)
    const estimatedGas = 65000n;
    const feeData = await this.provider.getFeeData();
    const gasPrice = feeData.gasPrice || 5000000000n; // 5 gwei fallback
    const gasCostWei = estimatedGas * gasPrice;
    const gasCostBnb = ethers.formatEther(gasCostWei);

    return {
      paymentAmount: amount,
      estimatedGas: estimatedGas.toString(),
      estimatedGasCost: `${gasCostBnb} BNB`,
      totalCost: `${amount} USDs + ${gasCostBnb} BNB`,
      savings: 'Use gasless=true to avoid gas costs'
    };
  }

  /**
   * Verify a payment transaction
   */
  async verifyPayment(transactionHash: string): Promise<{
    verified: boolean;
    status: string;
    blockNumber?: number;
    from?: string;
    to?: string;
    amount?: string;
  }> {
    try {
      // Try facilitator first
      const response = await globalThis.fetch(`${this.config.facilitatorUrl}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionHash })
      });

      if (response.ok) {
        const result = await response.json() as {
          verified: boolean;
          status: string;
          blockNumber?: number;
          from?: string;
          to?: string;
          amount?: string;
        };
        return {
          verified: result.verified,
          status: result.status,
          blockNumber: result.blockNumber,
          from: result.from,
          to: result.to,
          amount: result.amount
        };
      }
    } catch {
      // Fall back to direct chain verification
    }

    // Direct verification via RPC
    const receipt = await this.provider.getTransactionReceipt(transactionHash);
    
    if (!receipt) {
      return {
        verified: false,
        status: 'not_found'
      };
    }

    return {
      verified: receipt.status === 1,
      status: receipt.status === 1 ? 'success' : 'failed',
      blockNumber: receipt.blockNumber
    };
  }

  /**
   * Get all tool definitions
   */
  static getToolDefinitions() {
    return Object.values(speraxToolDefinitions);
  }
}

// ============================================
// MCP Server Integration
// ============================================

export function createMCPHandler(config: SperaxToolConfig = {}) {
  const tools = new SperaxX402Tools(config);

  return {
    tools: SperaxX402Tools.getToolDefinitions(),

    async handleToolCall(
      name: string,
      arguments_: Record<string, unknown>
    ): Promise<{ content: Array<{ type: string; text: string }> }> {
      try {
        const result = await tools.executeTool(name, arguments_);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          }]
        };
      }
    }
  };
}

export default SperaxX402Tools;
