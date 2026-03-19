import { describe, it, expect } from 'vitest';
import {
  validatePaymentPayload,
  validatePaymentRequirements,
  validateSettleRequirements,
} from '../src/routes/validation';

describe('validatePaymentPayload', () => {
  it('returns null for valid payload', () => {
    expect(
      validatePaymentPayload({
        x402Version: 2,
        payload: { signedBoc: 'dGVzdA==', walletPublicKey: 'a'.repeat(64) },
      }),
    ).toBeNull();
  });

  it('rejects non-object paymentPayload', () => {
    expect(validatePaymentPayload('string')).toContain('paymentPayload must be an object');
    expect(validatePaymentPayload(null)).toContain('paymentPayload must be an object');
    expect(validatePaymentPayload(42)).toContain('paymentPayload must be an object');
  });

  it('rejects array paymentPayload', () => {
    expect(validatePaymentPayload([1, 2, 3])).toContain('paymentPayload must be an object');
  });

  it('rejects non-object payload field', () => {
    expect(validatePaymentPayload({ payload: 'not-an-object' })).toContain(
      'paymentPayload.payload must be an object',
    );
  });

  it('rejects missing payload field', () => {
    expect(validatePaymentPayload({ x402Version: 2 })).toContain(
      'paymentPayload.payload must be an object',
    );
  });

  it('rejects non-string signedBoc', () => {
    expect(
      validatePaymentPayload({ payload: { signedBoc: 12345, walletPublicKey: 'abc' } }),
    ).toContain('signedBoc must be a non-empty string');
  });

  it('rejects empty string signedBoc', () => {
    expect(
      validatePaymentPayload({ payload: { signedBoc: '', walletPublicKey: 'abc' } }),
    ).toContain('signedBoc must be a non-empty string');
  });

  it('rejects non-string walletPublicKey', () => {
    expect(
      validatePaymentPayload({ payload: { signedBoc: 'dGVzdA==', walletPublicKey: 123 } }),
    ).toContain('walletPublicKey must be a string');
  });
});

describe('validatePaymentRequirements', () => {
  it('returns null for valid requirements', () => {
    expect(validatePaymentRequirements({ scheme: 'exact', network: 'tvm:-239' })).toBeNull();
  });

  it('rejects non-object paymentRequirements', () => {
    expect(validatePaymentRequirements('string')).toContain(
      'paymentRequirements must be an object',
    );
    expect(validatePaymentRequirements(null)).toContain('paymentRequirements must be an object');
    expect(validatePaymentRequirements(42)).toContain('paymentRequirements must be an object');
  });

  it('rejects array paymentRequirements', () => {
    expect(validatePaymentRequirements([1, 2, 3])).toContain(
      'paymentRequirements must be an object',
    );
  });

  it('rejects non-string scheme', () => {
    expect(validatePaymentRequirements({ scheme: 123, network: 'tvm:-239' })).toContain(
      'scheme must be a string',
    );
  });

  it('rejects missing scheme', () => {
    expect(validatePaymentRequirements({ network: 'tvm:-239' })).toContain(
      'scheme must be a string',
    );
  });

  it('rejects non-string network', () => {
    expect(validatePaymentRequirements({ scheme: 'exact', network: 123 })).toContain(
      'network must be a string',
    );
  });
});

describe('validateSettleRequirements', () => {
  it('returns null for valid settle requirements', () => {
    expect(
      validateSettleRequirements({
        scheme: 'exact',
        network: 'tvm:-239',
        amount: '1000000000',
        payTo: '0:' + '1'.repeat(64),
      }),
    ).toBeNull();
  });

  it('rejects non-string amount', () => {
    expect(
      validateSettleRequirements({
        scheme: 'exact',
        network: 'tvm:-239',
        amount: 1000000000,
        payTo: '0:' + '1'.repeat(64),
      }),
    ).toContain('amount must be a string');
  });

  it('rejects negative amount string', () => {
    expect(
      validateSettleRequirements({
        scheme: 'exact',
        network: 'tvm:-239',
        amount: '-100',
        payTo: '0:' + '1'.repeat(64),
      }),
    ).toContain('amount must be a positive integer string');
  });

  it('rejects zero amount', () => {
    expect(
      validateSettleRequirements({
        scheme: 'exact',
        network: 'tvm:-239',
        amount: '0',
        payTo: '0:' + '1'.repeat(64),
      }),
    ).toContain('amount must be a positive integer string');
  });

  it('rejects non-numeric amount string', () => {
    expect(
      validateSettleRequirements({
        scheme: 'exact',
        network: 'tvm:-239',
        amount: 'abc',
        payTo: '0:' + '1'.repeat(64),
      }),
    ).toContain('amount must be a positive integer string');
  });

  it('rejects missing payTo', () => {
    expect(
      validateSettleRequirements({
        scheme: 'exact',
        network: 'tvm:-239',
        amount: '1000000000',
      }),
    ).toContain('payTo must be a string');
  });

  it('rejects non-string payTo', () => {
    expect(
      validateSettleRequirements({
        scheme: 'exact',
        network: 'tvm:-239',
        amount: '1000000000',
        payTo: 12345,
      }),
    ).toContain('payTo must be a string');
  });
});
