/**
 * Tests for error handling utilities
 */

import { describe, it, expect } from 'vitest';
import {
  X402Error,
  err,
  wrapUnknown,
  safe,
  toDTO,
  isX402Error,
  assertNever,
  PaymentError,
  NetworkError,
  ERROR_CODES,
  type ErrorCode,
} from '../../src/errors.js';

describe('Error Handling', () => {
  describe('X402Error', () => {
    it('should create error with code and message', () => {
      const error = new X402Error('EINVALID_INPUT', 'Test error');
      expect(error.code).toBe('EINVALID_INPUT');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('X402Error');
    });

    it('should create error with cause', () => {
      const cause = new Error('Original error');
      const error = new X402Error('EINTERNAL', 'Wrapped error', { cause });
      expect(error.cause).toBe(cause);
    });

    it('should create error with details', () => {
      const details = { key: 'value', number: 42 };
      const error = new X402Error('EINVALID_INPUT', 'Test error', { details });
      expect(error.details).toEqual(details);
    });

    it('should create error with both cause and details', () => {
      const cause = new Error('Original');
      const details = { info: 'test' };
      const error = new X402Error('EINTERNAL', 'Test', {
        cause,
        details,
      });
      expect(error.cause).toBe(cause);
      expect(error.details).toEqual(details);
    });
  });

  describe('err factory functions', () => {
    describe('err.invalid', () => {
      it('should create invalid input error', () => {
        const error = err.invalid('Invalid data');
        expect(error.code).toBe('EINVALID_INPUT');
        expect(error.message).toBe('Invalid data');
      });

      it('should create invalid input error with details', () => {
        const error = err.invalid('Invalid data', { field: 'email' });
        expect(error.code).toBe('EINVALID_INPUT');
        expect(error.details).toEqual({ field: 'email' });
      });
    });

    describe('err.notFound', () => {
      it('should create not found error', () => {
        const error = err.notFound('User');
        expect(error.code).toBe('ENOT_FOUND');
        expect(error.message).toBe('User not found');
      });
    });

    describe('err.timeout', () => {
      it('should create timeout error', () => {
        const error = err.timeout(5000);
        expect(error.code).toBe('ETIMEOUT');
        expect(error.message).toBe('Timed out after 5000 ms');
        expect(error.details).toEqual({ ms: 5000 });
      });
    });

    describe('err.conflict', () => {
      it('should create conflict error', () => {
        const error = err.conflict('Resource already exists');
        expect(error.code).toBe('ECONFLICT');
        expect(error.message).toBe('Resource already exists');
      });

      it('should create conflict error with details', () => {
        const error = err.conflict('Duplicate key', { key: 'id' });
        expect(error.code).toBe('ECONFLICT');
        expect(error.details).toEqual({ key: 'id' });
      });
    });

    describe('err.cancelled', () => {
      it('should create cancelled error', () => {
        const error = err.cancelled();
        expect(error.code).toBe('ECANCELLED');
        expect(error.message).toBe('Operation cancelled');
      });
    });

    describe('err.internal', () => {
      it('should create internal error', () => {
        const error = err.internal('Something went wrong');
        expect(error.code).toBe('EINTERNAL');
        expect(error.message).toBe('Something went wrong');
      });

      it('should create internal error with cause', () => {
        const cause = new Error('Root cause');
        const error = err.internal('Internal failure', cause);
        expect(error.code).toBe('EINTERNAL');
        expect(error.cause).toBe(cause);
      });
    });

    describe('err.network', () => {
      it('should create network error', () => {
        const error = err.network('Connection failed');
        expect(error.code).toBe('ENETWORK');
        expect(error.message).toBe('Connection failed');
      });

      it('should create network error with cause', () => {
        const cause = new Error('Network timeout');
        const error = err.network('RPC failed', cause);
        expect(error.code).toBe('ENETWORK');
        expect(error.cause).toBe(cause);
      });

      it('should create network error with details', () => {
        const error = err.network('Request failed', undefined, {
          url: 'https://example.com',
        });
        expect(error.code).toBe('ENETWORK');
        expect(error.details).toEqual({ url: 'https://example.com' });
      });

      it('should create network error with cause and details', () => {
        const cause = new Error('Network error');
        const error = err.network('Request failed', cause, {
          url: 'https://example.com',
        });
        expect(error.code).toBe('ENETWORK');
        expect(error.cause).toBe(cause);
        expect(error.details).toEqual({ url: 'https://example.com' });
      });
    });

    describe('err.paymaster', () => {
      it('should create paymaster error', () => {
        const error = err.paymaster('Paymaster rejected');
        expect(error.code).toBe('EPAYMASTER');
        expect(error.message).toBe('Paymaster rejected');
      });

      it('should create paymaster error with cause', () => {
        const cause = new Error('Insufficient balance');
        const error = err.paymaster('Payment failed', cause);
        expect(error.code).toBe('EPAYMASTER');
        expect(error.cause).toBe(cause);
      });

      it('should create paymaster error with details', () => {
        const error = err.paymaster('Payment failed', undefined, {
          reason: 'invalid_signature',
        });
        expect(error.code).toBe('EPAYMASTER');
        expect(error.details).toEqual({ reason: 'invalid_signature' });
      });

      it('should create paymaster error with cause and details', () => {
        const cause = new Error('Transaction reverted');
        const error = err.paymaster('Execution failed', cause, {
          txHash: '0x123',
        });
        expect(error.code).toBe('EPAYMASTER');
        expect(error.cause).toBe(cause);
        expect(error.details).toEqual({ txHash: '0x123' });
      });
    });
  });

  describe('wrapUnknown', () => {
    it('should return X402Error unchanged', () => {
      const original = err.invalid('Test error');
      const wrapped = wrapUnknown(original);
      expect(wrapped).toBe(original);
    });

    it('should wrap Error into X402Error', () => {
      const original = new Error('Original error');
      const wrapped = wrapUnknown(original);
      expect(wrapped).toBeInstanceOf(X402Error);
      expect(wrapped.code).toBe('EINTERNAL');
      expect(wrapped.cause).toBe(original);
    });

    it('should wrap unknown value into X402Error', () => {
      const wrapped = wrapUnknown('string error');
      expect(wrapped).toBeInstanceOf(X402Error);
      expect(wrapped.code).toBe('EINTERNAL');
      expect(wrapped.cause).toBe('string error');
    });

    it('should use custom error code', () => {
      const wrapped = wrapUnknown(new Error('Test'), 'ENETWORK');
      expect(wrapped.code).toBe('ENETWORK');
    });

    it('should use custom note message', () => {
      const wrapped = wrapUnknown(
        new Error('Test'),
        'EINTERNAL',
        'Custom note'
      );
      expect(wrapped.message).toBe('Custom note');
    });
  });

  describe('safe', () => {
    it('should return success result for resolved promise', async () => {
      const result = await safe(Promise.resolve(42));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    it('should return error result for rejected promise', async () => {
      const result = await safe(Promise.reject(new Error('Test error')));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(X402Error);
      }
    });

    it('should wrap X402Error in rejected promise', async () => {
      const original = err.invalid('Test error');
      const result = await safe(Promise.reject(original));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(original);
      }
    });
  });

  describe('toDTO', () => {
    it('should convert X402Error to DTO', () => {
      const error = err.invalid('Test error', { field: 'email' });
      const dto = toDTO(error);
      expect(dto.name).toBe('X402Error');
      expect(dto.code).toBe('EINVALID_INPUT');
      expect(dto.message).toBe('Test error');
      expect(dto.details).toEqual({ field: 'email' });
    });

    it('should convert X402Error without details', () => {
      const error = err.invalid('Test error');
      const dto = toDTO(error);
      expect(dto.name).toBe('X402Error');
      expect(dto.code).toBe('EINVALID_INPUT');
      expect(dto.message).toBe('Test error');
      expect(dto.details).toBeUndefined();
    });

    it('should wrap and convert unknown error', () => {
      const dto = toDTO(new Error('Test error'));
      expect(dto.name).toBe('X402Error');
      expect(dto.code).toBe('EINTERNAL');
    });

    it('should not include cause in DTO', () => {
      const cause = new Error('Root cause');
      const error = err.internal('Test', cause);
      const dto = toDTO(error);
      expect('cause' in dto).toBe(false);
    });
  });

  describe('isX402Error', () => {
    it('should return true for X402Error', () => {
      const error = err.invalid('Test error');
      expect(isX402Error(error)).toBe(true);
    });

    it('should return false for regular Error', () => {
      const error = new Error('Test error');
      expect(isX402Error(error)).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isX402Error('string')).toBe(false);
      expect(isX402Error(42)).toBe(false);
      expect(isX402Error(null)).toBe(false);
      expect(isX402Error(undefined)).toBe(false);
    });

    it('should return false for plain object with code and message', () => {
      const obj = { code: 'EINVALID_INPUT', message: 'Test' };
      expect(isX402Error(obj)).toBe(false);
    });
  });

  describe('assertNever', () => {
    it('should throw internal error', () => {
      expect(() => assertNever({} as never)).toThrow(X402Error);
      try {
        assertNever({} as never);
      } catch (e) {
        expect(e).toBeInstanceOf(X402Error);
        if (e instanceof X402Error) {
          expect(e.code).toBe('EINTERNAL');
          expect(e.message).toContain('Unreachable');
        }
      }
    });
  });

  describe('PaymentError', () => {
    describe('invalidPayload', () => {
      it('should create invalid payload error', () => {
        const error = PaymentError.invalidPayload();
        expect(error.code).toBe('EINVALID_INPUT');
        expect(error.message).toContain('Invalid payment payload');
      });

      it('should create invalid payload error with details', () => {
        const error = PaymentError.invalidPayload('missing signature');
        expect(error.code).toBe('EINVALID_INPUT');
        expect(error.message).toContain('missing signature');
      });
    });

    describe('insufficientFunds', () => {
      it('should create insufficient funds error', () => {
        const error = PaymentError.insufficientFunds('1000', '500');
        expect(error.code).toBe('ECONFLICT');
        expect(error.message).toContain('Insufficient funds');
        expect(error.message).toContain('1000');
        expect(error.message).toContain('500');
        expect(error.details).toEqual({ required: '1000', available: '500' });
      });
    });

    describe('verificationFailed', () => {
      it('should create verification failed error', () => {
        const error = PaymentError.verificationFailed('invalid signature');
        expect(error.code).toBe('EINVALID_INPUT');
        expect(error.message).toContain('verification failed');
        expect(error.message).toContain('invalid signature');
      });
    });

    describe('settlementFailed', () => {
      it('should create settlement failed error', () => {
        const error = PaymentError.settlementFailed('transaction reverted');
        expect(error.code).toBe('EINTERNAL');
        expect(error.message).toContain('settlement failed');
        expect(error.message).toContain('transaction reverted');
      });
    });
  });

  describe('NetworkError', () => {
    describe('unsupportedNetwork', () => {
      it('should create unsupported network error', () => {
        const error = NetworkError.unsupportedNetwork('ethereum');
        expect(error.code).toBe('EINVALID_INPUT');
        expect(error.message).toContain('Unsupported network');
        expect(error.message).toContain('ethereum');
        expect(error.details).toEqual({ network: 'ethereum' });
      });
    });

    describe('networkMismatch', () => {
      it('should create network mismatch error', () => {
        const error = NetworkError.networkMismatch(
          'starknet:sepolia',
          'starknet:mainnet'
        );
        expect(error.code).toBe('ECONFLICT');
        expect(error.message).toContain('Network mismatch');
        expect(error.message).toContain('starknet:sepolia');
        expect(error.message).toContain('starknet:mainnet');
        expect(error.details).toEqual({
          expected: 'starknet:sepolia',
          actual: 'starknet:mainnet',
        });
      });
    });

    describe('rpcFailed', () => {
      it('should create RPC failed error', () => {
        const error = NetworkError.rpcFailed('connection timeout');
        expect(error.code).toBe('ENETWORK');
        expect(error.message).toContain('RPC call failed');
        expect(error.message).toContain('connection timeout');
      });

      it('should create RPC failed error with cause', () => {
        const cause = new Error('Network error');
        const error = NetworkError.rpcFailed('request failed', cause);
        expect(error.code).toBe('ENETWORK');
        expect(error.cause).toBe(cause);
      });
    });
  });

  describe('ERROR_CODES', () => {
    it('should have all error codes defined', () => {
      expect(ERROR_CODES.EINVALID_INPUT).toBe('EINVALID_INPUT');
      expect(ERROR_CODES.ENOT_FOUND).toBe('ENOT_FOUND');
      expect(ERROR_CODES.ETIMEOUT).toBe('ETIMEOUT');
      expect(ERROR_CODES.ECONFLICT).toBe('ECONFLICT');
      expect(ERROR_CODES.ECANCELLED).toBe('ECANCELLED');
      expect(ERROR_CODES.EINTERNAL).toBe('EINTERNAL');
      expect(ERROR_CODES.ENETWORK).toBe('ENETWORK');
      expect(ERROR_CODES.EPAYMASTER).toBe('EPAYMASTER');
    });
  });
});
