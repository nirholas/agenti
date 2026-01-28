/**
 * Merchant Payment Flow
 * Handles QR code generation, deep links, and payment status polling
 */

import { Invoice, getInvoice, isInvoiceValid } from './invoice';
import { generateQRCodeSVG, QRCodeOptions, DEFAULT_QR_OPTIONS } from '../qr/generator';

const CROSSFUND_API_URL = process.env.CROSSFUND_API_URL || 'https://payments.crossfund.xyz';
const CROSSFUND_API_KEY = process.env.CROSSFUND_API_KEY || '';
const CROSSFUND_MERCHANT_ID = process.env.CROSSFUND_MERCHANT_ID || '';

/**
 * Supported wallet apps for deep linking
 */
export type WalletApp = 
  | 'metamask'
  | 'rainbow'
  | 'coinbase'
  | 'trust'
  | 'walletconnect'
  | 'phantom'
  | 'generic';

/**
 * Payment QR data structure
 */
export interface PaymentQRData {
  invoiceId: string;
  paymentUrl: string;
  amount: string;
  currency: string;
  recipientAddress: string;
  chainId: number;
  tokenAddress?: string;
  memo?: string;
}

/**
 * Deep link generation result
 */
export interface DeepLinkResult {
  wallet: WalletApp;
  deepLink: string;
  universalLink?: string;
  fallbackUrl: string;
}

/**
 * Payment status response
 */
export interface PaymentStatusResponse {
  success: boolean;
  invoiceId: string;
  status: Invoice['status'];
  paidAmount?: string;
  paidCurrency?: string;
  transactionHash?: string;
  confirmations?: number;
  error?: string;
}

/**
 * Payment polling options
 */
export interface PollingOptions {
  intervalMs?: number;
  maxAttempts?: number;
  onStatusChange?: (status: PaymentStatusResponse) => void;
}

/**
 * Token conversion preferences
 */
export interface ConversionPreferences {
  preferredCurrency: string;
  acceptedSlippage: number; // percentage
  autoConvert: boolean;
}

/**
 * Generate payment QR code for an invoice
 */
export async function generatePaymentQR(
  invoice: Invoice,
  options?: Partial<QRCodeOptions>
): Promise<{ success: boolean; qrDataUrl?: string; error?: string }> {
  try {
    if (!isInvoiceValid(invoice)) {
      return { success: false, error: 'Invoice is not valid or has expired' };
    }

    // Generate payment URL
    const paymentUrl = `${CROSSFUND_API_URL}/pay/${invoice.invoiceId}`;

    // Generate QR code
    const qrOptions: QRCodeOptions = {
      ...DEFAULT_QR_OPTIONS,
      ...options,
      width: options?.width || 300,
      margin: options?.margin || 2,
    };

    const qrResult = await generateQRCodeSVG(paymentUrl, qrOptions);

    if (!qrResult.success) {
      return { success: false, error: qrResult.error };
    }

    return { success: true, qrDataUrl: qrResult.dataUrl };
  } catch (error) {
    console.error('Error generating payment QR:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate QR code',
    };
  }
}

/**
 * Generate EIP-681 payment URI for Ethereum-compatible wallets
 * Format: ethereum:pay-<address>@<chainId>/transfer?address=<token>&uint256=<amount>
 */
export function generateEIP681Uri(
  recipientAddress: string,
  amount: string,
  chainId: number,
  tokenAddress?: string
): string {
  const amountWei = parseAmountToWei(amount);
  
  if (tokenAddress) {
    // ERC20 token transfer
    return `ethereum:${tokenAddress}@${chainId}/transfer?address=${recipientAddress}&uint256=${amountWei}`;
  }
  
  // Native ETH transfer
  return `ethereum:${recipientAddress}@${chainId}?value=${amountWei}`;
}

/**
 * Parse amount string to wei (18 decimals)
 */
function parseAmountToWei(amount: string, decimals: number = 18): string {
  const [whole, fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  return `${whole}${paddedFraction}`.replace(/^0+/, '') || '0';
}

/**
 * Generate deep link for specific wallet app
 */
export function generateDeepLink(
  invoice: Invoice,
  wallet: WalletApp,
  chainId: number = 1,
  recipientAddress?: string
): DeepLinkResult {
  const paymentUrl = `${CROSSFUND_API_URL}/pay/${invoice.invoiceId}`;
  const fallbackUrl = paymentUrl;
  const encodedUrl = encodeURIComponent(paymentUrl);
  
  // Default recipient address (should be fetched from merchant settings)
  const recipient = recipientAddress || process.env.MERCHANT_WALLET_ADDRESS || '';
  
  let deepLink = paymentUrl;
  let universalLink: string | undefined;

  switch (wallet) {
    case 'metamask':
      // MetaMask deep link
      deepLink = `metamask://wc?uri=${encodedUrl}`;
      universalLink = `https://metamask.app.link/wc?uri=${encodedUrl}`;
      break;

    case 'rainbow':
      // Rainbow Wallet deep link
      deepLink = `rainbow://wc?uri=${encodedUrl}`;
      universalLink = `https://rnbwapp.com/wc?uri=${encodedUrl}`;
      break;

    case 'coinbase':
      // Coinbase Wallet deep link
      deepLink = `cbwallet://wc?uri=${encodedUrl}`;
      universalLink = `https://go.cb-w.com/wc?uri=${encodedUrl}`;
      break;

    case 'trust':
      // Trust Wallet deep link
      deepLink = `trust://wc?uri=${encodedUrl}`;
      universalLink = `https://link.trustwallet.com/wc?uri=${encodedUrl}`;
      break;

    case 'walletconnect':
      // WalletConnect universal link
      deepLink = `wc:${paymentUrl}`;
      universalLink = paymentUrl;
      break;

    case 'phantom':
      // Phantom (Solana) deep link
      deepLink = `phantom://browse/${encodedUrl}`;
      universalLink = `https://phantom.app/ul/browse/${encodedUrl}`;
      break;

    case 'generic':
    default:
      // Generic payment link
      deepLink = paymentUrl;
      universalLink = paymentUrl;
      break;
  }

  return {
    wallet,
    deepLink,
    universalLink,
    fallbackUrl,
  };
}

/**
 * Generate all wallet deep links for an invoice
 */
export function generateAllDeepLinks(
  invoice: Invoice,
  chainId: number = 1
): DeepLinkResult[] {
  const wallets: WalletApp[] = [
    'metamask',
    'rainbow',
    'coinbase',
    'trust',
    'walletconnect',
    'phantom',
  ];

  return wallets.map(wallet => generateDeepLink(invoice, wallet, chainId));
}

/**
 * Get payment status for an invoice
 */
export async function getPaymentStatus(invoiceId: string): Promise<PaymentStatusResponse> {
  try {
    const invoiceResult = await getInvoice(invoiceId);

    if (!invoiceResult.success || !invoiceResult.invoice) {
      return {
        success: false,
        invoiceId,
        status: 'pending',
        error: invoiceResult.error || 'Invoice not found',
      };
    }

    const invoice = invoiceResult.invoice;

    // Fetch detailed payment status from API
    const response = await fetch(
      `${CROSSFUND_API_URL}/api/v1/invoices/${invoiceId}/status`,
      {
        headers: {
          'Authorization': `Bearer ${CROSSFUND_API_KEY}`,
          'X-Merchant-ID': CROSSFUND_MERCHANT_ID,
        },
      }
    );

    if (!response.ok) {
      return {
        success: true,
        invoiceId,
        status: invoice.status,
      };
    }

    const statusData = await response.json();

    return {
      success: true,
      invoiceId,
      status: statusData.status || invoice.status,
      paidAmount: statusData.paidAmount,
      paidCurrency: statusData.paidCurrency,
      transactionHash: statusData.transactionHash,
      confirmations: statusData.confirmations,
    };
  } catch (error) {
    console.error('Error getting payment status:', error);
    return {
      success: false,
      invoiceId,
      status: 'pending',
      error: error instanceof Error ? error.message : 'Failed to get payment status',
    };
  }
}

/**
 * Poll payment status until completion or timeout
 */
export async function pollPaymentStatus(
  invoiceId: string,
  options: PollingOptions = {}
): Promise<PaymentStatusResponse> {
  const {
    intervalMs = 3000,
    maxAttempts = 100, // ~5 minutes with 3s interval
    onStatusChange,
  } = options;

  let lastStatus: Invoice['status'] | null = null;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const status = await getPaymentStatus(invoiceId);

    // Notify on status change
    if (onStatusChange && status.status !== lastStatus) {
      onStatusChange(status);
      lastStatus = status.status;
    }

    // Return if payment is complete (paid, expired, or cancelled)
    if (status.status === 'paid' || status.status === 'expired' || status.status === 'cancelled') {
      return status;
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs));
    attempts++;
  }

  // Timeout
  return {
    success: false,
    invoiceId,
    status: 'pending',
    error: 'Polling timeout',
  };
}

/**
 * Request automatic token conversion to merchant's preferred currency
 */
export async function requestTokenConversion(
  invoiceId: string,
  preferences: ConversionPreferences
): Promise<{ success: boolean; error?: string; estimatedOutput?: string }> {
  try {
    const response = await fetch(
      `${CROSSFUND_API_URL}/api/v1/invoices/${invoiceId}/convert`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CROSSFUND_API_KEY}`,
          'X-Merchant-ID': CROSSFUND_MERCHANT_ID,
        },
        body: JSON.stringify({
          preferredCurrency: preferences.preferredCurrency,
          acceptedSlippage: preferences.acceptedSlippage,
          autoConvert: preferences.autoConvert,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || 'Failed to request conversion',
      };
    }

    const data = await response.json();
    return {
      success: true,
      estimatedOutput: data.estimatedOutput,
    };
  } catch (error) {
    console.error('Error requesting token conversion:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to request conversion',
    };
  }
}

/**
 * Get conversion quote for received payment
 */
export async function getConversionQuote(
  invoiceId: string,
  targetCurrency: string
): Promise<{
  success: boolean;
  inputAmount?: string;
  inputCurrency?: string;
  outputAmount?: string;
  outputCurrency?: string;
  exchangeRate?: string;
  error?: string;
}> {
  try {
    const response = await fetch(
      `${CROSSFUND_API_URL}/api/v1/invoices/${invoiceId}/conversion-quote?target=${targetCurrency}`,
      {
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
        error: errorData.message || 'Failed to get conversion quote',
      };
    }

    const data = await response.json();
    return {
      success: true,
      inputAmount: data.inputAmount,
      inputCurrency: data.inputCurrency,
      outputAmount: data.outputAmount,
      outputCurrency: data.outputCurrency,
      exchangeRate: data.exchangeRate,
    };
  } catch (error) {
    console.error('Error getting conversion quote:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get conversion quote',
    };
  }
}

/**
 * Generate payment page URL for redirection
 */
export function getPaymentPageUrl(invoiceId: string): string {
  return `${CROSSFUND_API_URL}/pay/${invoiceId}`;
}

/**
 * Generate embeddable payment widget URL
 */
export function getPaymentWidgetUrl(
  invoiceId: string,
  options?: {
    theme?: 'light' | 'dark';
    locale?: string;
    showBranding?: boolean;
  }
): string {
  const params = new URLSearchParams();
  params.set('embed', 'true');
  
  if (options?.theme) params.set('theme', options.theme);
  if (options?.locale) params.set('locale', options.locale);
  if (options?.showBranding !== undefined) {
    params.set('branding', options.showBranding.toString());
  }

  return `${CROSSFUND_API_URL}/pay/${invoiceId}?${params.toString()}`;
}
