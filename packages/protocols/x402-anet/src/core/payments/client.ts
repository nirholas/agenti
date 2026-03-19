import { ethers } from 'ethers';
import { BudgetManager } from './budget.js';
import { PaymentTracker, type PaymentRecord } from './tracker.js';

export interface X402ClientOptions {
  maxRetries?: number;
  budgetManager?: BudgetManager;
  tracker?: PaymentTracker;
}

export class X402Client {
  private wallet: ethers.Wallet;
  private maxRetries: number;
  private budget: BudgetManager;
  private tracker: PaymentTracker;

  constructor(wallet: ethers.Wallet, options: X402ClientOptions = {}) {
    this.wallet = wallet;
    this.maxRetries = options.maxRetries ?? 3;
    this.budget = options.budgetManager ?? new BudgetManager();
    this.tracker = options.tracker ?? new PaymentTracker();
  }

  async fetch(url: string, init: RequestInit = {}): Promise<Response> {
    let response = await fetch(url, init);

    if (response.status !== 402) {
      return response;
    }

    // Handle 402 - payment required
    for (let retry = 0; retry < this.maxRetries; retry++) {
      const paymentReq = await response.json();
      const amount = parseInt(paymentReq.amount) / 1_000_000; // USDC decimals

      // Check budget
      const budgetCheck = this.budget.checkBudget(amount);
      if (!budgetCheck.allowed) {
        throw new Error(`Budget exceeded: ${budgetCheck.reason}`);
      }

      // Create payment payload (ERC-3009 TransferWithAuthorization)
      const paymentPayload = await this.createPaymentPayload(paymentReq);

      // Retry with payment
      const headers = new Headers(init.headers);
      headers.set('X-Payment', paymentPayload);

      response = await fetch(url, { ...init, headers });

      if (response.status === 200) {
        // Track successful payment
        this.budget.recordSpend(amount, url);
        this.tracker.track({
          timestamp: new Date().toISOString(),
          service: url,
          amount: amount.toString(),
          currency: paymentReq.currency || 'USDC',
          direction: 'sent',
        });
        return response;
      }

      if (response.status !== 402) {
        return response; // Different error, stop retrying
      }
    }

    return response; // Return last 402 response
  }

  private async createPaymentPayload(paymentReq: any): Promise<string> {
    const nonce = ethers.randomBytes(32);
    const validBefore = Math.floor(Date.now() / 1000) + 3600;

    const payload = {
      from: this.wallet.address,
      to: paymentReq.recipient,
      value: paymentReq.amount,
      validAfter: 0,
      validBefore,
      nonce: ethers.hexlify(nonce),
      signature: await this.wallet.signMessage(
        `X402 Payment: ${paymentReq.amount} to ${paymentReq.recipient}`
      ),
    };

    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }
}
