import QRCode from 'qrcode';
import { ChainId, PaymentRequest, QRCodeData } from '../types';

const QR_VERSION = 1;
const BASE_URL = 'https://qrpay.xyz/pay';

/**
 * QR Code generation options
 */
export interface QRCodeOptions {
  width?: number;
  margin?: number;
  color?: { dark: string; light: string };
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

/**
 * Default QR code options
 */
export const DEFAULT_QR_OPTIONS: QRCodeOptions = {
  width: 300,
  margin: 2,
  color: {
    dark: '#000000',
    light: '#FFFFFF',
  },
  errorCorrectionLevel: 'M',
};

/**
 * Generate QR code data structure
 */
export function createQRCodeData(
  recipient: string,
  options: {
    username?: string;
    amount?: string;
    chainId?: ChainId;
    memo?: string;
  } = {}
): QRCodeData {
  return {
    version: QR_VERSION,
    type: 'payment',
    recipient,
    username: options.username,
    amount: options.amount,
    chainId: options.chainId || 1,
    memo: options.memo,
  };
}

/**
 * Encode QR data to URL
 */
export function encodeQRUrl(data: QRCodeData): string {
  const params = new URLSearchParams();
  params.set('to', data.recipient);
  
  if (data.username) params.set('u', data.username);
  if (data.amount) params.set('amt', data.amount);
  if (data.chainId && data.chainId !== 1) params.set('c', data.chainId.toString());
  if (data.memo) params.set('m', data.memo);
  
  return `${BASE_URL}?${params.toString()}`;
}

/**
 * Decode URL back to QR data
 */
export function decodeQRUrl(url: string): QRCodeData {
  const urlObj = new URL(url);
  const params = urlObj.searchParams;
  
  const recipient = params.get('to');
  if (!recipient) {
    throw new Error('Invalid QR code: missing recipient');
  }
  
  return {
    version: QR_VERSION,
    type: 'payment',
    recipient,
    username: params.get('u') || undefined,
    amount: params.get('amt') || undefined,
    chainId: (parseInt(params.get('c') || '1') as ChainId) || 1,
    memo: params.get('m') || undefined,
  };
}

/**
 * Generate QR code as data URL (for display in browser)
 */
export async function generateQRCodeDataURL(
  data: QRCodeData,
  options: {
    width?: number;
    margin?: number;
    color?: { dark: string; light: string };
  } = {}
): Promise<string> {
  const url = encodeQRUrl(data);
  
  return QRCode.toDataURL(url, {
    width: options.width || 300,
    margin: options.margin || 2,
    color: options.color || {
      dark: '#000000',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'M',
  });
}

/**
 * Generate QR code as SVG string
 */
export async function generateQRCodeSVG(
  data: QRCodeData | string,
  options: QRCodeOptions = {}
): Promise<{ success: boolean; svg?: string; dataUrl?: string; error?: string }> {
  try {
    const url = typeof data === 'string' ? data : encodeQRUrl(data);
    
    const svg = await QRCode.toString(url, {
      type: 'svg',
      width: options.width || DEFAULT_QR_OPTIONS.width,
      margin: options.margin || DEFAULT_QR_OPTIONS.margin,
      color: options.color || DEFAULT_QR_OPTIONS.color,
      errorCorrectionLevel: options.errorCorrectionLevel || DEFAULT_QR_OPTIONS.errorCorrectionLevel,
    });

    // Also generate data URL for convenience
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
 * Create a payment request and generate QR code
 */
export async function createPaymentQR(
  recipient: string,
  options: {
    username?: string;
    amount?: string;
    chainId?: ChainId;
    memo?: string;
    format?: 'dataUrl' | 'svg';
    width?: number;
  } = {}
): Promise<{ paymentUrl: string; qrCode: string; data: QRCodeData }> {
  const data = createQRCodeData(recipient, options);
  const paymentUrl = encodeQRUrl(data);
  
  let qrCode: string;
  if (options.format === 'svg') {
    const result = await generateQRCodeSVG(data, { width: options.width });
    qrCode = result.svg || '';
  } else {
    qrCode = await generateQRCodeDataURL(data, { width: options.width });
  }
  
  return { paymentUrl, qrCode, data };
}
