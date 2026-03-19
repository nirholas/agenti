export const TEST_SCHEME = "test";
export const TEST_NETWORK = "test-local";
export const TEST_ASSET = "TEST";

/**
 * Checks if a payment requirement matches the test scheme and network.
 */
export function isMatchingRequirement(req: {
  scheme: string;
  network: string;
}): boolean {
  return (
    req.scheme.toLowerCase() === TEST_SCHEME.toLowerCase() &&
    req.network.toLowerCase() === TEST_NETWORK.toLowerCase()
  );
}
