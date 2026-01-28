// API type definitions for QR Pay

import { SupportedChainId } from './chain';
import { TokenInfo, TokenPrice } from './token';
import { SwapRequest, SwapResponse } from './swap';
import { Invoice, Merchant, Payment, Webhook } from './merchant';

// Generic API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  statusCode: number;
}

export interface ApiMeta {
  requestId: string;
  timestamp: string;
  latency: number; // ms
  rateLimit?: RateLimitInfo;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
}

// x402 Payment header
export interface X402PaymentHeader {
  token: string;
  amount: string;
  recipient: string;
  signature: string;
  timestamp: number;
  nonce: string;
}

// Swap API types
export interface SwapQuoteRequest extends SwapRequest {}

export interface SwapQuoteResponse extends ApiResponse<SwapResponse> {}

export interface SwapExecuteResponse extends ApiResponse<{
  transactionHash: string;
  status: 'pending' | 'submitted';
  chainId: SupportedChainId;
}> {}

// Token API types
export interface TokenListRequest {
  chainId: SupportedChainId;
  includeNative?: boolean;
  includeLpTokens?: boolean;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}

export interface TokenListResponse extends ApiResponse<{
  tokens: TokenInfo[];
  total: number;
  hasMore: boolean;
}> {}

export interface TokenPriceRequest {
  tokens: {
    address: string;
    chainId: SupportedChainId;
  }[];
}

export interface TokenPriceResponse extends ApiResponse<{
  prices: TokenPrice[];
  timestamp: Date;
}> {}

// Chain API types
export interface ChainListResponse extends ApiResponse<{
  chains: ChainInfo[];
  total: number;
}> {}

export interface ChainInfo {
  id: SupportedChainId;
  name: string;
  shortName: string;
  isActive: boolean;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrl: string;
  blockExplorerUrl: string;
  iconUrl?: string;
  averageBlockTime: number;
}

// Invoice API types
export interface CreateInvoiceApiRequest {
  amount: string;
  currency?: string;
  chainId?: SupportedChainId;
  memo?: string;
  metadata?: Record<string, string>;
  externalId?: string;
  customerEmail?: string;
  expiresIn?: number;
  redirectUrl?: string;
}

export interface CreateInvoiceApiResponse extends ApiResponse<{
  invoice: Invoice;
  paymentUrl: string;
  qrCodeDataUrl: string;
}> {}

export interface GetInvoiceApiResponse extends ApiResponse<Invoice> {}

export interface ListInvoicesApiRequest {
  status?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface ListInvoicesApiResponse extends ApiResponse<{
  invoices: Invoice[];
  total: number;
  hasMore: boolean;
}> {}

// Payment API types
export interface PaymentApiResponse extends ApiResponse<Payment> {}

export interface ListPaymentsApiRequest {
  invoiceId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface ListPaymentsApiResponse extends ApiResponse<{
  payments: Payment[];
  total: number;
  hasMore: boolean;
}> {}

// Webhook API types
export interface CreateWebhookApiRequest {
  url: string;
  events: string[];
}

export interface CreateWebhookApiResponse extends ApiResponse<{
  webhook: Webhook;
  secret: string;
}> {}

export interface ListWebhooksApiResponse extends ApiResponse<{
  webhooks: Webhook[];
}> {}

// Merchant API types
export interface MerchantApiResponse extends ApiResponse<Merchant> {}

export interface UpdateMerchantApiRequest {
  displayName?: string;
  email?: string;
  logoUrl?: string;
  websiteUrl?: string;
  description?: string;
  settings?: Partial<{
    defaultChainId: SupportedChainId;
    acceptedChains: SupportedChainId[];
    autoConvertToStable: boolean;
    preferredStablecoin: 'USDC' | 'USDT' | 'DAI';
    webhookUrl: string;
    notifyOnPayment: boolean;
    notificationEmail: string;
  }>;
}

// Health check types
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  services: {
    database: ServiceStatus;
    blockchain: ServiceStatus;
    cache: ServiceStatus;
  };
}

export interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  message?: string;
}

// CrossFund API specific types
export interface CrossFundSwapRequest {
  fromChainId: number;
  fromAssetAddress: string;
  toChainId: number;
  toAssetAddress: string;
  inputAmountHuman?: string;
  outputAmountHuman?: string;
  userWalletAddress: string;
  recipient?: string;
  slippage?: number;
}

export interface CrossFundSwapResponse {
  route: {
    to: string;
    data: string;
    value: string;
    chainId: number;
    gasLimit?: string;
    type: 'approval' | 'swap' | 'bridge';
  }[];
  output: {
    amount: string;
    minimumAmount: string;
    token: TokenInfo;
  };
  input: {
    amount: string;
    token: TokenInfo;
  };
  swapTime: number;
  deadline: number;
  slippage: number;
  fees: {
    gas: string;
    protocol: string;
    bridge?: string;
  };
}

// Request/Response with pagination
export interface PaginatedRequest {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
