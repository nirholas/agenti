/**
 * GET/POST /api/merchant/settings
 * Merchant settings management
 */

import { NextRequest, NextResponse } from 'next/server';

const CROSSFUND_API_URL = process.env.CROSSFUND_API_URL || 'https://payments.crossfund.xyz';
const CROSSFUND_API_KEY = process.env.CROSSFUND_API_KEY || '';
const CROSSFUND_MERCHANT_ID = process.env.CROSSFUND_MERCHANT_ID || '';

export interface MerchantSettings {
  merchantId: string;
  businessName: string;
  businessEmail: string;
  businessUrl?: string;
  logoUrl?: string;
  
  // Payment settings
  defaultCurrency: string;
  acceptedTokens: string[];
  acceptedChains: number[];
  minimumPaymentAmount?: string;
  maximumPaymentAmount?: string;
  
  // Conversion settings
  autoConvertEnabled: boolean;
  preferredSettlementCurrency: string;
  acceptedSlippage: number; // percentage
  
  // Payout settings
  payoutAddress: string;
  payoutChainId: number;
  autoPayoutEnabled: boolean;
  autoPayoutThreshold?: string;
  
  // Notification settings
  emailNotificationsEnabled: boolean;
  webhookNotificationsEnabled: boolean;
  notificationEmails: string[];
  
  // Branding
  brandColor?: string;
  supportEmail?: string;
  supportUrl?: string;
  
  // Security
  twoFactorEnabled: boolean;
  ipWhitelist?: string[];
  
  createdAt: string;
  updatedAt: string;
}

export interface UpdateSettingsRequest {
  businessName?: string;
  businessEmail?: string;
  businessUrl?: string;
  logoUrl?: string;
  defaultCurrency?: string;
  acceptedTokens?: string[];
  acceptedChains?: number[];
  minimumPaymentAmount?: string;
  maximumPaymentAmount?: string;
  autoConvertEnabled?: boolean;
  preferredSettlementCurrency?: string;
  acceptedSlippage?: number;
  payoutAddress?: string;
  payoutChainId?: number;
  autoPayoutEnabled?: boolean;
  autoPayoutThreshold?: string;
  emailNotificationsEnabled?: boolean;
  webhookNotificationsEnabled?: boolean;
  notificationEmails?: string[];
  brandColor?: string;
  supportEmail?: string;
  supportUrl?: string;
  twoFactorEnabled?: boolean;
  ipWhitelist?: string[];
}

/**
 * GET - Retrieve current merchant settings
 */
export async function GET() {
  try {
    const response = await fetch(
      `${CROSSFUND_API_URL}/api/v1/merchant/settings`,
      {
        headers: {
          'Authorization': `Bearer ${CROSSFUND_API_KEY}`,
          'X-Merchant-ID': CROSSFUND_MERCHANT_ID,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Failed to fetch settings' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      settings: data.settings,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Update merchant settings
 */
export async function POST(request: NextRequest) {
  try {
    const body: UpdateSettingsRequest = await request.json();

    // Validate settings
    const validationError = validateSettings(body);
    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${CROSSFUND_API_URL}/api/v1/merchant/settings`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CROSSFUND_API_KEY}`,
          'X-Merchant-ID': CROSSFUND_MERCHANT_ID,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Failed to update settings' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      settings: data.settings,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Validate settings before updating
 */
function validateSettings(settings: UpdateSettingsRequest): string | null {
  // Validate email
  if (settings.businessEmail && !isValidEmail(settings.businessEmail)) {
    return 'Invalid business email';
  }

  // Validate notification emails
  if (settings.notificationEmails) {
    for (const email of settings.notificationEmails) {
      if (!isValidEmail(email)) {
        return `Invalid notification email: ${email}`;
      }
    }
  }

  // Validate URLs
  if (settings.businessUrl && !isValidUrl(settings.businessUrl)) {
    return 'Invalid business URL';
  }

  if (settings.logoUrl && !isValidUrl(settings.logoUrl)) {
    return 'Invalid logo URL';
  }

  if (settings.supportUrl && !isValidUrl(settings.supportUrl)) {
    return 'Invalid support URL';
  }

  // Validate payout address
  if (settings.payoutAddress && !isValidAddress(settings.payoutAddress)) {
    return 'Invalid payout address';
  }

  // Validate slippage
  if (settings.acceptedSlippage !== undefined) {
    if (settings.acceptedSlippage < 0 || settings.acceptedSlippage > 50) {
      return 'Slippage must be between 0 and 50%';
    }
  }

  // Validate amounts
  if (settings.minimumPaymentAmount && parseFloat(settings.minimumPaymentAmount) < 0) {
    return 'Minimum payment amount must be positive';
  }

  if (settings.maximumPaymentAmount && parseFloat(settings.maximumPaymentAmount) < 0) {
    return 'Maximum payment amount must be positive';
  }

  if (
    settings.minimumPaymentAmount &&
    settings.maximumPaymentAmount &&
    parseFloat(settings.minimumPaymentAmount) > parseFloat(settings.maximumPaymentAmount)
  ) {
    return 'Minimum payment amount must be less than maximum';
  }

  // Validate IP whitelist
  if (settings.ipWhitelist) {
    for (const ip of settings.ipWhitelist) {
      if (!isValidIP(ip)) {
        return `Invalid IP address: ${ip}`;
      }
    }
  }

  return null;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidAddress(address: string): boolean {
  // Ethereum address validation
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function isValidIP(ip: string): boolean {
  // IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.');
    return parts.every(part => parseInt(part, 10) <= 255);
  }
  
  // IPv6 validation (simplified)
  const ipv6Regex = /^([a-fA-F0-9:]+)$/;
  return ipv6Regex.test(ip);
}
