/** Server-level error codes (complement SDK X402ErrorCode for HTTP-layer concerns) */
export const ServerErrorCode = {
  rate_limited: 'rate_limited',
  unexpected_error: 'unexpected_error',
  unexpected_settle_error: 'unexpected_settle_error',
  settlement_in_progress: 'settlement_in_progress',
} as const;

export type ServerErrorCodeValue = (typeof ServerErrorCode)[keyof typeof ServerErrorCode];
