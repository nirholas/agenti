/**
 * Merchant Invoice System
 * Handles invoice creation and management via CrossFund API
 */

const CROSSFUND_API_URL = process.env.CROSSFUND_API_URL || 'https://payments.crossfund.xyz';
const CROSSFUND_API_KEY = process.env.CROSSFUND_API_KEY || '';
const CROSSFUND_MERCHANT_ID = process.env.CROSSFUND_MERCHANT_ID || '';

export interface Invoice {
  invoiceId: string;
  merchantId: string;
  amount: string;
  currency: string;
  acceptedTokens: string[];
  acceptedChains: number[];
  callbackUrl: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, any>;
  expiresAt: number;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
}

export interface CreateInvoiceParams {
  amount: string;
  currency: string;
  acceptedTokens?: string[];
  acceptedChains?: number[];
  callbackUrl?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, any>;
  expiresIn?: number; // seconds until expiry
}

export interface InvoiceResponse {
  success: boolean;
  invoice?: Invoice;
  error?: string;
  paymentUrl?: string;
}

export interface ListInvoicesParams {
  page?: number;
  limit?: number;
  status?: Invoice['status'];
  startDate?: Date;
  endDate?: Date;
}

export interface ListInvoicesResponse {
  success: boolean;
  invoices: Invoice[];
  total: number;
  page: number;
  limit: number;
  error?: string;
}

/**
 * Default accepted tokens if not specified
 */
const DEFAULT_ACCEPTED_TOKENS = ['USDC', 'USDT', 'ETH', 'WETH', 'DAI'];

/**
 * Default accepted chains if not specified
 * 1: Ethereum, 137: Polygon, 42161: Arbitrum, 10: Optimism, 8453: Base
 */
const DEFAULT_ACCEPTED_CHAINS = [1, 137, 42161, 10, 8453];

/**
 * Default invoice expiry time (30 minutes)
 */
const DEFAULT_EXPIRY_SECONDS = 30 * 60;

/**
 * Create a new invoice via CrossFund API
 */
export async function createInvoice(params: CreateInvoiceParams): Promise<InvoiceResponse> {
  try {
    const {
      amount,
      currency,
      acceptedTokens = DEFAULT_ACCEPTED_TOKENS,
      acceptedChains = DEFAULT_ACCEPTED_CHAINS,
      callbackUrl,
      successUrl,
      cancelUrl,
      metadata = {},
      expiresIn = DEFAULT_EXPIRY_SECONDS,
    } = params;

    // Validate required fields
    if (!amount || parseFloat(amount) <= 0) {
      return { success: false, error: 'Invalid amount' };
    }

    if (!currency) {
      return { success: false, error: 'Currency is required' };
    }

    if (!successUrl || !cancelUrl) {
      return { success: false, error: 'Success and cancel URLs are required' };
    }

    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

    const requestBody = {
      merchantId: CROSSFUND_MERCHANT_ID,
      amount,
      currency,
      acceptedTokens,
      acceptedChains,
      callbackUrl: callbackUrl || `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/crossfund`,
      successUrl,
      cancelUrl,
      metadata,
      expiresAt,
    };

    const response = await fetch(`${CROSSFUND_API_URL}/api/v1/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CROSSFUND_API_KEY}`,
        'X-Merchant-ID': CROSSFUND_MERCHANT_ID,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || `Failed to create invoice: ${response.status}`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      invoice: data.invoice,
      paymentUrl: data.paymentUrl,
    };
  } catch (error) {
    console.error('Error creating invoice:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating invoice',
    };
  }
}

/**
 * Get invoice by ID
 */
export async function getInvoice(invoiceId: string): Promise<InvoiceResponse> {
  try {
    if (!invoiceId) {
      return { success: false, error: 'Invoice ID is required' };
    }

    const response = await fetch(`${CROSSFUND_API_URL}/api/v1/invoices/${invoiceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CROSSFUND_API_KEY}`,
        'X-Merchant-ID': CROSSFUND_MERCHANT_ID,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: 'Invoice not found' };
      }
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || `Failed to get invoice: ${response.status}`,
      };
    }

    const data = await response.json();
    return { success: true, invoice: data.invoice };
  } catch (error) {
    console.error('Error getting invoice:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error getting invoice',
    };
  }
}

/**
 * List invoices with filtering and pagination
 */
export async function listInvoices(params: ListInvoicesParams = {}): Promise<ListInvoicesResponse> {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      startDate,
      endDate,
    } = params;

    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (status) queryParams.append('status', status);
    if (startDate) queryParams.append('startDate', startDate.toISOString());
    if (endDate) queryParams.append('endDate', endDate.toISOString());

    const response = await fetch(
      `${CROSSFUND_API_URL}/api/v1/invoices?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${CROSSFUND_API_KEY}`,
          'X-Merchant-ID': CROSSFUND_MERCHANT_ID,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        invoices: [],
        total: 0,
        page,
        limit,
        error: errorData.message || `Failed to list invoices: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      invoices: data.invoices,
      total: data.total,
      page: data.page,
      limit: data.limit,
    };
  } catch (error) {
    console.error('Error listing invoices:', error);
    return {
      success: false,
      invoices: [],
      total: 0,
      page: params.page || 1,
      limit: params.limit || 20,
      error: error instanceof Error ? error.message : 'Unknown error listing invoices',
    };
  }
}

/**
 * Cancel an invoice
 */
export async function cancelInvoice(invoiceId: string): Promise<InvoiceResponse> {
  try {
    if (!invoiceId) {
      return { success: false, error: 'Invoice ID is required' };
    }

    const response = await fetch(`${CROSSFUND_API_URL}/api/v1/invoices/${invoiceId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CROSSFUND_API_KEY}`,
        'X-Merchant-ID': CROSSFUND_MERCHANT_ID,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || `Failed to cancel invoice: ${response.status}`,
      };
    }

    const data = await response.json();
    return { success: true, invoice: data.invoice };
  } catch (error) {
    console.error('Error cancelling invoice:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error cancelling invoice',
    };
  }
}

/**
 * Check if an invoice is still valid (not expired)
 */
export function isInvoiceValid(invoice: Invoice): boolean {
  if (invoice.status !== 'pending') {
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  return invoice.expiresAt > now;
}

/**
 * Get time remaining until invoice expires (in seconds)
 */
export function getInvoiceTimeRemaining(invoice: Invoice): number {
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, invoice.expiresAt - now);
}

/**
 * Format invoice amount for display
 */
export function formatInvoiceAmount(amount: string, currency: string): string {
  const numAmount = parseFloat(amount);
  
  // Common fiat currencies
  const fiatCurrencies: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
  };

  if (fiatCurrencies[currency]) {
    return `${fiatCurrencies[currency]}${numAmount.toFixed(2)}`;
  }

  // Crypto currencies
  return `${numAmount} ${currency}`;
}
