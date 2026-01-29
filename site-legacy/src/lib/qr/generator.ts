/**
 * QR Code Generator
 * Generate payment QR codes with deep links
 */

import QRCode from 'qrcode';

const QR_VERSION = 1;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://agenti.cash';

export interface PaymentQRData {
  version: number;
  type: 'payment';
  recipient: string;
  username?: string;
  amount?: string;
  chainId?: number;
  tokenAddress?: string;
  memo?: string;
}

export interface QRCodeOptions {
  width?: number;
  margin?: number;
  color?: { dark: string; light: string };
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

const DEFAULT_QR_OPTIONS: QRCodeOptions = {
  width: 300,
  margin: 2,
  color: {
    dark: '#000000',
    light: '#FFFFFF',
  },
  errorCorrectionLevel: 'M',
};

/**
 * Create payment QR data structure
 */
export function createPaymentQRData(
  recipient: string,
  options: {
    username?: string;
    amount?: string;
    chainId?: number;
    tokenAddress?: string;
    memo?: string;
  } = {}
): PaymentQRData {
  return {
    version: QR_VERSION,
    type: 'payment',
    recipient,
    ...options,
  };
}

/**
 * Encode QR data to payment URL
 */
export function encodePaymentUrl(data: PaymentQRData): string {
  const params = new URLSearchParams();
  params.set('to', data.recipient);

  if (data.username) params.set('u', data.username);
  if (data.amount) params.set('amt', data.amount);
  if (data.chainId && data.chainId !== 1) params.set('c', data.chainId.toString());
  if (data.tokenAddress) params.set('token', data.tokenAddress);
  if (data.memo) params.set('m', data.memo);

  return `${BASE_URL}/pay?${params.toString()}`;
}

/**
 * Decode payment URL back to QR data
 */
export function decodePaymentUrl(url: string): PaymentQRData {
  const urlObj = new URL(url);
  const params = urlObj.searchParams;

  const recipient = params.get('to');
  if (!recipient) {
    throw new Error('Invalid payment QR: missing recipient');
  }

  return {
    version: QR_VERSION,
    type: 'payment',
    recipient,
    username: params.get('u') || undefined,
    amount: params.get('amt') || undefined,
    chainId: parseInt(params.get('c') || '1') || 1,
    tokenAddress: params.get('token') || undefined,
    memo: params.get('m') || undefined,
  };
}

/**
 * Generate QR code as data URL (for img src)
 */
export async function generateQRCodeDataURL(
  data: PaymentQRData | string,
  options: QRCodeOptions = {}
): Promise<string> {
  const url = typeof data === 'string' ? data : encodePaymentUrl(data);

  return QRCode.toDataURL(url, {
    width: options.width || DEFAULT_QR_OPTIONS.width,
    margin: options.margin || DEFAULT_QR_OPTIONS.margin,
    color: options.color || DEFAULT_QR_OPTIONS.color,
    errorCorrectionLevel: options.errorCorrectionLevel || DEFAULT_QR_OPTIONS.errorCorrectionLevel,
  });
}

/**
 * Generate QR code as SVG string
 */
export async function generateQRCodeSVG(
  data: PaymentQRData | string,
  options: QRCodeOptions = {}
): Promise<{ success: boolean; svg?: string; dataUrl?: string; error?: string }> {
  try {
    const url = typeof data === 'string' ? data : encodePaymentUrl(data);

    const svg = await QRCode.toString(url, {
      type: 'svg',
      width: options.width || DEFAULT_QR_OPTIONS.width,
      margin: options.margin || DEFAULT_QR_OPTIONS.margin,
      color: options.color || DEFAULT_QR_OPTIONS.color,
      errorCorrectionLevel: options.errorCorrectionLevel || DEFAULT_QR_OPTIONS.errorCorrectionLevel,
    });

    const dataUrl = await QRCode.toDataURL(url, {
      width: options.width || DEFAULT_QR_OPTIONS.width,
      margin: options.margin || DEFAULT_QR_OPTIONS.margin,
      color: options.color || DEFAULT_QR_OPTIONS.color,
      errorCorrectionLevel: options.errorCorrectionLevel || DEFAULT_QR_OPTIONS.errorCorrectionLevel,
    });

    return { success: true, svg, dataUrl };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate QR code',
    };
  }
}

/**
 * Generate QR code for wallet address (simple receive)
 */
export async function generateAddressQR(
  address: string,
  chainId: number = 1,
  options: QRCodeOptions = {}
): Promise<string> {
  const data: PaymentQRData = {
    version: QR_VERSION,
    type: 'payment',
    recipient: address,
    chainId,
  };

  return generateQRCodeDataURL(data, options);
}

/**
 * Generate invoice QR with amount
 */
export async function generateInvoiceQR(
  recipient: string,
  amount: string,
  tokenAddress?: string,
  chainId: number = 1,
  memo?: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const data: PaymentQRData = {
    version: QR_VERSION,
    type: 'payment',
    recipient,
    amount,
    tokenAddress,
    chainId,
    memo,
  };

  return generateQRCodeDataURL(data, options);
}
