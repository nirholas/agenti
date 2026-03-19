import { describe, it, expect, vi } from 'vitest';
import {
  buildTransaction,
  executeTransaction,
  createTransferCall,
  extractTypedData,
  DEFAULT_PAYMASTER_ENDPOINTS,
} from '../../src/paymaster/helpers.js';
import type { PaymasterClient } from '../../src/paymaster/client.js';
import type { BuildTransactionResponse } from '../../src/types/paymaster.js';

describe('Paymaster Helpers', () => {
  describe('createTransferCall', () => {
    it('should create a valid transfer call', () => {
      const tokenAddress =
        '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
      const recipient = '0x1234567890abcdef';
      const amount = '1000000';

      const call = createTransferCall(tokenAddress, recipient, amount);

      expect(call).toEqual({
        contractAddress: tokenAddress,
        entrypoint: 'transfer',
        calldata: [recipient, amount, '0'],
      });
    });

    it('should handle large amounts', () => {
      const tokenAddress = '0xtoken';
      const recipient = '0xrecipient';
      const amount = '999999999999999999';

      const call = createTransferCall(tokenAddress, recipient, amount);

      expect(call.calldata).toEqual([recipient, amount, '0']);
    });
  });

  describe('buildTransaction', () => {
    it('should call client buildTransaction with correct parameters', async () => {
      const mockClient = {
        buildTransaction: vi.fn().mockResolvedValue({
          type: 'invoke',
          typed_data: {
            domain: {},
            types: {},
            primaryType: 'Invoke',
            message: {},
          },
          calls: [],
        }),
      } as unknown as PaymasterClient;

      const userAddress = '0x1234';
      const tokenAddress =
        '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
      const recipientAddress =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const calls = [
        {
          contractAddress: tokenAddress,
          entrypoint: 'transfer',
          calldata: [recipientAddress, '1000', '0'],
        },
      ];

      await buildTransaction(mockClient, userAddress, calls, {
        mode: 'sponsored',
      });

      // The helper converts starknet.js Call format to paymaster RPC format
      const callArgs = mockClient.buildTransaction.mock.calls[0][0];
      expect(callArgs.transaction.type).toBe('invoke');
      expect(callArgs.transaction.invoke.user_address).toBe('0x1234');
      expect(callArgs.parameters.version).toBe('0x1');
      expect(callArgs.parameters.fee_mode).toEqual({ mode: 'sponsored' });
      // Verify the call was converted to paymaster format (has 'to', 'selector', 'calldata')
      expect(callArgs.transaction.invoke.calls[0]).toHaveProperty('to');
      expect(callArgs.transaction.invoke.calls[0]).toHaveProperty('selector');
      expect(callArgs.transaction.invoke.calls[0]).toHaveProperty('calldata');
    });

    it('should support default fee mode with gas token', async () => {
      const mockClient = {
        buildTransaction: vi.fn().mockResolvedValue({
          type: 'invoke',
          typed_data: {
            domain: {},
            types: {},
            primaryType: 'Invoke',
            message: {},
          },
          calls: [],
        }),
      } as unknown as PaymasterClient;

      await buildTransaction(mockClient, '0x1234', [], {
        mode: 'default',
        gas_token: '0xeth',
      });

      expect(mockClient.buildTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: expect.objectContaining({
            fee_mode: { mode: 'default', gas_token: '0xeth' },
          }),
        })
      );
    });
  });

  describe('executeTransaction', () => {
    it('should call client executeTransaction with correct parameters', async () => {
      const mockClient = {
        executeTransaction: vi.fn().mockResolvedValue({
          transaction_hash: '0xhash',
        }),
      } as unknown as PaymasterClient;

      const userAddress = '0x1234';
      const tokenAddress =
        '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
      const recipientAddress =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const calls = [
        {
          contractAddress: tokenAddress,
          entrypoint: 'transfer',
          calldata: [recipientAddress, '1000', '0'],
        },
      ];
      const typedData = {
        domain: { name: 'Test' },
        types: {},
        primaryType: 'Invoke',
        message: {},
      };
      const signature = ['0xsig1', '0xsig2'];

      await executeTransaction(
        mockClient,
        userAddress,
        calls,
        { mode: 'sponsored' },
        typedData,
        signature
      );

      // Note: typed_data and signature go INSIDE the invoke object
      expect(mockClient.executeTransaction).toHaveBeenCalledWith({
        transaction: {
          type: 'invoke',
          invoke: {
            user_address: '0x1234',
            typed_data: typedData,
            signature,
          },
        },
        parameters: {
          version: '0x1',
          fee_mode: { mode: 'sponsored' },
        },
      });
    });
  });

  describe('extractTypedData', () => {
    it('should extract typed data from invoke response', () => {
      const typedData = {
        domain: { name: 'Test' },
        types: {},
        primaryType: 'Invoke',
        message: {},
      };

      const response: BuildTransactionResponse = {
        type: 'invoke',
        typed_data: typedData,
        calls: [],
      };

      const result = extractTypedData(response);
      expect(result).toEqual(typedData);
    });

    it('should extract typed data from deploy_and_invoke response', () => {
      const typedData = {
        domain: { name: 'Test' },
        types: {},
        primaryType: 'DeployAndInvoke',
        message: {},
      };

      const response: BuildTransactionResponse = {
        type: 'deploy_and_invoke',
        typed_data: typedData,
        calls: [],
        deploy: {
          class_hash: '0xclass',
          constructor_calldata: [],
          contract_address: '0xcontract',
          salt: '0x0',
        },
      };

      const result = extractTypedData(response);
      expect(result).toEqual(typedData);
    });

    it('should throw error for deploy-only transaction', () => {
      const response: BuildTransactionResponse = {
        type: 'deploy',
        deploy: {
          class_hash: '0xclass',
          constructor_calldata: [],
          contract_address: '0xcontract',
          salt: '0x0',
        },
      };

      expect(() => extractTypedData(response)).toThrow(
        'No typed data in deploy-only transaction'
      );
    });
  });

  describe('DEFAULT_PAYMASTER_ENDPOINTS', () => {
    it('should have correct endpoints for all networks', () => {
      expect(DEFAULT_PAYMASTER_ENDPOINTS).toEqual({
        'starknet:mainnet': 'https://starknet.paymaster.avnu.fi',
        'starknet:sepolia': 'http://localhost:12777',
        'starknet:devnet': 'http://localhost:12777',
      });
    });

    it('should have mainnet endpoint', () => {
      expect(DEFAULT_PAYMASTER_ENDPOINTS['starknet:mainnet']).toBe(
        'https://starknet.paymaster.avnu.fi'
      );
    });

    it('should have sepolia endpoint', () => {
      expect(DEFAULT_PAYMASTER_ENDPOINTS['starknet:sepolia']).toBe(
        'http://localhost:12777'
      );
    });

    it('should have devnet endpoint', () => {
      expect(DEFAULT_PAYMASTER_ENDPOINTS['starknet:devnet']).toBe(
        'http://localhost:12777'
      );
    });
  });
});
