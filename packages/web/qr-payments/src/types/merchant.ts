// Merchant type definitions for QR Pay

import { SupportedChainId } from './chain';
import { TokenInfo } from './token';

// Merchant profile
export interface Merchant {
  id: string;
  walletAddress: string;
  businessName: string;
  displayName?: string;
  email?: string;
  logoUrl?: string;
  websiteUrl?: string;
  description?: string;
  category?: MerchantCategory;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  settings: MerchantSettings;
  apiKeys: ApiKey[];
}

export type MerchantCategory =
  | 'retail'
  | 'restaurant'
  | 'services'
  | 'software'
  | 'nonprofit'
  | 'creator'
  | 'other';

// Merchant settings
export interface MerchantSettings {
  defaultChainId: SupportedChainId;
  acceptedChains: SupportedChainId[];
  acceptedTokens: TokenInfo[];
  autoConvertToStable: boolean;
  preferredStablecoin: 'USDC' | 'USDT' | 'DAI';
  minPaymentAmount?: string;
  maxPaymentAmount?: string;
  requireMemo: boolean;
  webhookUrl?: string;
  webhookSecret?: string;
  notifyOnPayment: boolean;
  notificationEmail?: string;
}

// API key for merchant integrations
export interface ApiKey {
  id: string;
  merchantId: string;
  name: string;
  keyPrefix: string; // First 8 chars for identification
  hashedKey: string;
  permissions: ApiPermission[];
  rateLimit: number; // requests per minute
  isActive: boolean;
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

export type ApiPermission =
  | 'invoices:read'
  | 'invoices:write'
  | 'payments:read'
  | 'webhooks:manage'
  | 'settings:read'
  | 'settings:write';

// Invoice
export interface Invoice {
  id: string;
  merchantId: string;
  status: InvoiceStatus;
  amount: string;
  currency: string; // Token symbol
  chainId: SupportedChainId;
  recipient: string; // Merchant wallet
  memo?: string;
  metadata?: Record<string, string>;
  externalId?: string; // Merchant's reference ID
  customerEmail?: string;
  paymentUrl: string;
  qrCodeUrl: string;
  expiresAt: Date;
  paidAt?: Date;
  paidTxHash?: string;
  paidAmount?: string;
  paidToken?: TokenInfo;
  refundedAt?: Date;
  refundTxHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type InvoiceStatus =
  | 'draft'
  | 'pending' // Awaiting payment
  | 'processing' // Payment detected, awaiting confirmation
  | 'paid'
  | 'expired'
  | 'cancelled'
  | 'refunded'
  | 'partially_refunded';

// Invoice creation request
export interface CreateInvoiceRequest {
  amount: string;
  currency?: string; // Default: USDC
  chainId?: SupportedChainId;
  memo?: string;
  metadata?: Record<string, string>;
  externalId?: string;
  customerEmail?: string;
  expiresIn?: number; // Minutes, default 60
  redirectUrl?: string; // Where to redirect after payment
  webhookUrl?: string; // Override merchant default
}

// Invoice response
export interface InvoiceResponse {
  invoice: Invoice;
  paymentAddress: string;
  paymentUrl: string;
  qrCodeDataUrl: string;
}

// Webhook
export interface Webhook {
  id: string;
  merchantId: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  isActive: boolean;
  failureCount: number;
  lastTriggeredAt?: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  createdAt: Date;
}

export type WebhookEvent =
  | 'invoice.created'
  | 'invoice.paid'
  | 'invoice.expired'
  | 'invoice.cancelled'
  | 'payment.received'
  | 'payment.confirmed'
  | 'payment.failed'
  | 'refund.initiated'
  | 'refund.completed';

// Webhook delivery
export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  payload: WebhookPayload;
  statusCode?: number;
  response?: string;
  attempts: number;
  nextRetryAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
}

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Invoice | Payment;
  signature: string;
}

// Payment record
export interface Payment {
  id: string;
  invoiceId?: string;
  merchantId: string;
  senderAddress: string;
  recipientAddress: string;
  inputToken: TokenInfo;
  inputAmount: string;
  outputToken: TokenInfo;
  outputAmount: string;
  chainId: SupportedChainId;
  txHash: string;
  blockNumber: number;
  status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;
  fee: string;
  feeUSD: string;
  createdAt: Date;
  confirmedAt?: Date;
}

// Merchant analytics
export interface MerchantAnalytics {
  merchantId: string;
  period: 'day' | 'week' | 'month' | 'year' | 'all';
  totalPayments: number;
  totalVolume: string;
  totalVolumeUSD: string;
  averagePayment: string;
  averagePaymentUSD: string;
  uniqueCustomers: number;
  topTokens: {
    token: TokenInfo;
    volume: string;
    count: number;
  }[];
  topChains: {
    chainId: SupportedChainId;
    volume: string;
    count: number;
  }[];
  paymentsByStatus: Record<InvoiceStatus, number>;
  recentPayments: Payment[];
}

// Merchant onboarding
export interface MerchantOnboardingRequest {
  walletAddress: string;
  businessName: string;
  email: string;
  category?: MerchantCategory;
  websiteUrl?: string;
  signature: string; // Signed message to prove wallet ownership
  timestamp: number;
}

export interface MerchantOnboardingResponse {
  merchant: Merchant;
  apiKey: {
    key: string; // Only returned once at creation
    id: string;
    prefix: string;
  };
  webhookSecret: string;
}
