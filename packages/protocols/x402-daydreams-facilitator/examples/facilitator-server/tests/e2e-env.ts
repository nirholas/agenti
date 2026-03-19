const DEFAULT_E2E_PRIVATE_KEY =
  "0x0000000000000000000000000000000000000000000000000000000000000001";

const HEX_64 = /^[0-9a-fA-F]{64}$/;
const HEX_0X_64 = /^0x[0-9a-fA-F]{64}$/;

/**
 * Returns a valid hex private key for e2e tests.
 * Falls back to a known public test key when input is missing or malformed.
 */
export function resolveE2ePrivateKey(value?: string): string {
  if (!value) return DEFAULT_E2E_PRIVATE_KEY;
  if (HEX_0X_64.test(value)) return value;
  if (HEX_64.test(value)) return `0x${value}`;
  return DEFAULT_E2E_PRIVATE_KEY;
}

export { DEFAULT_E2E_PRIVATE_KEY };
