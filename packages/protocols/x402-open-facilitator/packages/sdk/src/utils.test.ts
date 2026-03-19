import { describe, it, expect } from 'vitest';
import {
  isPaymentPayload,
  isPaymentPayloadV1,
  isPaymentPayloadV2,
  isPaymentRequirementsV1,
  isPaymentRequirementsV2,
  getSchemeNetwork,
  getVersion,
  getVersionSafe,
  assertNever,
} from './utils.js';
import type {
  PaymentPayloadV1,
  PaymentPayloadV2,
  PaymentRequirementsV1,
  PaymentRequirementsV2,
} from './types.js';

// ============ Test Fixtures ============

const validV1Payload: PaymentPayloadV1 = {
  x402Version: 1,
  scheme: 'exact',
  network: 'base',
  payload: {
    signature: '0xabc123',
    authorization: {
      from: '0x1234',
      to: '0x5678',
      amount: '1000000',
      asset: '0xusdc',
    },
  },
};

const validV2Payload: PaymentPayloadV2 = {
  x402Version: 2,
  accepted: {
    scheme: 'exact',
    network: 'eip155:8453',
    asset: '0xusdc',
    amount: '1000000',
    payTo: '0x5678',
    maxTimeoutSeconds: 300,
  },
  payload: {
    signature: '0xdef456',
  },
};

const validV1Requirements: PaymentRequirementsV1 = {
  scheme: 'exact',
  network: 'base',
  maxAmountRequired: '1000000',
  asset: '0xusdc',
};

const validV2Requirements: PaymentRequirementsV2 = {
  scheme: 'exact',
  network: 'eip155:8453',
  amount: '1000000',
  asset: '0xusdc',
  payTo: '0x5678',
  maxTimeoutSeconds: 300,
  extra: {},
};

// ============ isPaymentPayload ============

describe('isPaymentPayload', () => {
  it('returns true for valid v1 payload', () => {
    expect(isPaymentPayload(validV1Payload)).toBe(true);
  });

  it('returns true for valid v2 payload', () => {
    expect(isPaymentPayload(validV2Payload)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isPaymentPayload(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isPaymentPayload(undefined)).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(isPaymentPayload('string')).toBe(false);
    expect(isPaymentPayload(123)).toBe(false);
    expect(isPaymentPayload([])).toBe(false);
  });

  it('returns false for invalid version', () => {
    expect(isPaymentPayload({ x402Version: 3 })).toBe(false);
    expect(isPaymentPayload({ x402Version: 'v1' })).toBe(false);
  });

  it('returns false for v1 missing scheme', () => {
    const invalid = { ...validV1Payload, scheme: undefined };
    expect(isPaymentPayload(invalid)).toBe(false);
  });

  it('returns false for v2 missing accepted', () => {
    const invalid = { x402Version: 2, payload: {} };
    expect(isPaymentPayload(invalid)).toBe(false);
  });
});

// ============ isPaymentPayloadV1 ============

describe('isPaymentPayloadV1', () => {
  it('returns true for valid v1 payload', () => {
    expect(isPaymentPayloadV1(validV1Payload)).toBe(true);
  });

  it('returns false for v2 payload', () => {
    expect(isPaymentPayloadV2(validV1Payload)).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isPaymentPayloadV1(null)).toBe(false);
    expect(isPaymentPayloadV1(undefined)).toBe(false);
  });

  it('returns false if x402Version is not 1', () => {
    expect(isPaymentPayloadV1({ ...validV1Payload, x402Version: 2 })).toBe(false);
  });

  it('returns false if scheme is missing', () => {
    const { scheme, ...rest } = validV1Payload;
    expect(isPaymentPayloadV1(rest)).toBe(false);
  });

  it('returns false if network is missing', () => {
    const { network, ...rest } = validV1Payload;
    expect(isPaymentPayloadV1(rest)).toBe(false);
  });

  it('returns false if payload is missing', () => {
    const { payload, ...rest } = validV1Payload;
    expect(isPaymentPayloadV1(rest)).toBe(false);
  });
});

// ============ isPaymentPayloadV2 ============

describe('isPaymentPayloadV2', () => {
  it('returns true for valid v2 payload', () => {
    expect(isPaymentPayloadV2(validV2Payload)).toBe(true);
  });

  it('returns false for v1 payload', () => {
    expect(isPaymentPayloadV2(validV1Payload)).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isPaymentPayloadV2(null)).toBe(false);
    expect(isPaymentPayloadV2(undefined)).toBe(false);
  });

  it('returns false if x402Version is not 2', () => {
    const invalid = { ...validV2Payload, x402Version: 1 };
    expect(isPaymentPayloadV2(invalid)).toBe(false);
  });

  it('returns false if accepted is missing', () => {
    const { accepted, ...rest } = validV2Payload;
    expect(isPaymentPayloadV2(rest)).toBe(false);
  });

  it('returns false if accepted.scheme is missing', () => {
    const invalid = {
      ...validV2Payload,
      accepted: { ...validV2Payload.accepted, scheme: undefined },
    };
    expect(isPaymentPayloadV2(invalid)).toBe(false);
  });

  it('returns false if accepted.network is missing', () => {
    const invalid = {
      ...validV2Payload,
      accepted: { ...validV2Payload.accepted, network: undefined },
    };
    expect(isPaymentPayloadV2(invalid)).toBe(false);
  });

  it('returns false if accepted.asset is missing', () => {
    const invalid = {
      ...validV2Payload,
      accepted: { ...validV2Payload.accepted, asset: undefined },
    };
    expect(isPaymentPayloadV2(invalid)).toBe(false);
  });

  it('returns false if accepted.amount is missing', () => {
    const invalid = {
      ...validV2Payload,
      accepted: { ...validV2Payload.accepted, amount: undefined },
    };
    expect(isPaymentPayloadV2(invalid)).toBe(false);
  });

  it('returns false if accepted.payTo is missing', () => {
    const invalid = {
      ...validV2Payload,
      accepted: { ...validV2Payload.accepted, payTo: undefined },
    };
    expect(isPaymentPayloadV2(invalid)).toBe(false);
  });

  it('returns false if accepted.maxTimeoutSeconds is missing', () => {
    const invalid = {
      ...validV2Payload,
      accepted: { ...validV2Payload.accepted, maxTimeoutSeconds: undefined },
    };
    expect(isPaymentPayloadV2(invalid)).toBe(false);
  });

  it('returns true with optional resource field', () => {
    const withResource = {
      ...validV2Payload,
      resource: { url: 'https://example.com/resource' },
    };
    expect(isPaymentPayloadV2(withResource)).toBe(true);
  });

  it('returns true with optional extensions field', () => {
    const withExtensions = {
      ...validV2Payload,
      extensions: { foo: 'bar' },
    };
    expect(isPaymentPayloadV2(withExtensions)).toBe(true);
  });
});

// ============ isPaymentRequirementsV1 ============

describe('isPaymentRequirementsV1', () => {
  it('returns true for v1 requirements (has maxAmountRequired)', () => {
    expect(isPaymentRequirementsV1(validV1Requirements)).toBe(true);
  });

  it('returns false for v2 requirements (no maxAmountRequired)', () => {
    expect(isPaymentRequirementsV1(validV2Requirements)).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isPaymentRequirementsV1(null)).toBe(false);
    expect(isPaymentRequirementsV1(undefined)).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(isPaymentRequirementsV1('string')).toBe(false);
  });
});

// ============ isPaymentRequirementsV2 ============

describe('isPaymentRequirementsV2', () => {
  it('returns true for v2 requirements (has amount, no maxAmountRequired)', () => {
    expect(isPaymentRequirementsV2(validV2Requirements)).toBe(true);
  });

  it('returns false for v1 requirements (has maxAmountRequired)', () => {
    expect(isPaymentRequirementsV2(validV1Requirements)).toBe(false);
  });

  it('returns false if has both amount and maxAmountRequired', () => {
    const ambiguous = { ...validV2Requirements, maxAmountRequired: '500' };
    expect(isPaymentRequirementsV2(ambiguous)).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isPaymentRequirementsV2(null)).toBe(false);
    expect(isPaymentRequirementsV2(undefined)).toBe(false);
  });
});

// ============ getSchemeNetwork ============

describe('getSchemeNetwork', () => {
  it('extracts from top level for v1 payload', () => {
    const result = getSchemeNetwork(validV1Payload);
    expect(result).toEqual({
      scheme: 'exact',
      network: 'base',
    });
  });

  it('extracts from accepted for v2 payload', () => {
    const result = getSchemeNetwork(validV2Payload);
    expect(result).toEqual({
      scheme: 'exact',
      network: 'eip155:8453',
    });
  });

  it('handles v1 with different scheme/network', () => {
    const payload: PaymentPayloadV1 = {
      ...validV1Payload,
      scheme: 'streaming',
      network: 'solana',
    };
    const result = getSchemeNetwork(payload);
    expect(result).toEqual({
      scheme: 'streaming',
      network: 'solana',
    });
  });

  it('handles v2 with different scheme/network in accepted', () => {
    const payload: PaymentPayloadV2 = {
      ...validV2Payload,
      accepted: {
        ...validV2Payload.accepted,
        scheme: 'streaming',
        network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      },
    };
    const result = getSchemeNetwork(payload);
    expect(result).toEqual({
      scheme: 'streaming',
      network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    });
  });
});

// ============ getVersion ============

describe('getVersion', () => {
  it('returns 1 for v1 payload', () => {
    expect(getVersion(validV1Payload)).toBe(1);
  });

  it('returns 2 for v2 payload', () => {
    expect(getVersion(validV2Payload)).toBe(2);
  });

  it('returns literal type for exhaustiveness checking', () => {
    const version = getVersion(validV1Payload);
    // TypeScript should narrow this to 1 | 2
    const check: 1 | 2 = version;
    expect(check).toBe(1);
  });
});

// ============ getVersionSafe ============

describe('getVersionSafe', () => {
  describe('valid versions', () => {
    it('returns 1 for v1 payload', () => {
      expect(getVersionSafe(validV1Payload)).toBe(1);
    });

    it('returns 2 for v2 payload', () => {
      expect(getVersionSafe(validV2Payload)).toBe(2);
    });
  });

  describe('backward compatibility (missing version defaults to 1)', () => {
    it('returns 1 for null', () => {
      expect(getVersionSafe(null)).toBe(1);
    });

    it('returns 1 for undefined', () => {
      expect(getVersionSafe(undefined)).toBe(1);
    });

    it('returns 1 for non-object', () => {
      expect(getVersionSafe('string')).toBe(1);
      expect(getVersionSafe(123)).toBe(1);
    });

    it('returns 1 for object without x402Version', () => {
      expect(getVersionSafe({})).toBe(1);
      expect(getVersionSafe({ scheme: 'exact' })).toBe(1);
    });

    it('returns 1 for object with undefined x402Version', () => {
      expect(getVersionSafe({ x402Version: undefined })).toBe(1);
    });
  });

  describe('unsupported versions throw', () => {
    it('throws for x402Version: 0', () => {
      expect(() => getVersionSafe({ x402Version: 0 })).toThrow(
        'Unsupported x402 version: 0. SDK supports versions 1 and 2.'
      );
    });

    it('throws for x402Version: 3', () => {
      expect(() => getVersionSafe({ x402Version: 3 })).toThrow(
        'Unsupported x402 version: 3. SDK supports versions 1 and 2.'
      );
    });

    it('throws for x402Version: "v1" (string)', () => {
      expect(() => getVersionSafe({ x402Version: 'v1' })).toThrow(
        'Unsupported x402 version: v1. SDK supports versions 1 and 2.'
      );
    });

    it('throws for x402Version: -1', () => {
      expect(() => getVersionSafe({ x402Version: -1 })).toThrow(
        'Unsupported x402 version: -1. SDK supports versions 1 and 2.'
      );
    });
  });
});

// ============ assertNever ============

describe('assertNever', () => {
  it('throws with default message including value', () => {
    // We need to cast to never to test this
    const value = { foo: 'bar' } as never;
    expect(() => assertNever(value)).toThrow(
      'Unhandled discriminated union member: {"foo":"bar"}'
    );
  });

  it('throws with custom message when provided', () => {
    const value = 'unexpected' as never;
    expect(() => assertNever(value, 'Custom error message')).toThrow(
      'Custom error message'
    );
  });

  it('is used for exhaustiveness checking in switch statements', () => {
    // This is a compile-time check, but we can demonstrate the pattern
    function handleVersion(version: 1 | 2): string {
      switch (version) {
        case 1:
          return 'v1';
        case 2:
          return 'v2';
        default:
          return assertNever(version);
      }
    }

    expect(handleVersion(1)).toBe('v1');
    expect(handleVersion(2)).toBe('v2');
  });
});
