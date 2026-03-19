/**
 * Payload structure for test payment scheme transactions.
 */
export type TestPaymentPayload = {
  testId: string;
  amount: string;
  timestamp: number;
  metadata?: Record<string, unknown> | undefined;
};

/**
 * Generates a unique test payment identifier.
 *
 * @returns A string like "test-1234567890-abc123".
 */
export function generateTestId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
