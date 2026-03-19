import { describe, expect, it } from 'bun:test';

import type {
  PublicClientLike,
  WalletClientLike,
} from '../registries/identity';
import { createReputationRegistryClient } from '../registries/reputation';
import type { PublicClientWithReceipt } from '../registries/utils';

const REGISTRY_ADDRESS = '0x000000000000000000000000000000000000dEaD' as const;

function makeClients() {
  type WriteContractArgs = Parameters<WalletClientLike['writeContract']>[0];
  type ReadContractArgs = Parameters<PublicClientLike['readContract']>[0];
  type ReadContractResult = Awaited<
    ReturnType<PublicClientLike['readContract']>
  >;
  type WaitForTransactionReceiptArgs = Parameters<
    NonNullable<PublicClientWithReceipt['waitForTransactionReceipt']>
  >[0];
  type WaitForTransactionReceiptResult = Awaited<
    ReturnType<
      NonNullable<PublicClientWithReceipt['waitForTransactionReceipt']>
    >
  >;

  let writeArgs: WriteContractArgs | undefined;

  const mockWalletClient: WalletClientLike = {
    account: {
      address: '0x0000000000000000000000000000000000001234' as const,
    },
    async writeContract(args: WriteContractArgs) {
      writeArgs = args;
      return '0xtxhash' as const;
    },
  };

  const mockPublicClient: PublicClientLike & PublicClientWithReceipt = {
    async readContract(args: ReadContractArgs): Promise<ReadContractResult> {
      if (args.functionName === 'readFeedback') {
        return [12n, 2, 'tag-a', 'tag-b', false];
      }
      if (args.functionName === 'getSummary') {
        return [3n, 120n, 2];
      }
      if (args.functionName === 'readAllFeedback') {
        return [
          ['0x0000000000000000000000000000000000001111'],
          [1n],
          [12n],
          [2],
          ['tag-a'],
          ['tag-b'],
          [false],
        ];
      }
      return true;
    },
    async waitForTransactionReceipt(
      _args: WaitForTransactionReceiptArgs
    ): Promise<WaitForTransactionReceiptResult> {
      return { logs: [] };
    },
  };

  const client = createReputationRegistryClient({
    address: REGISTRY_ADDRESS,
    chainId: 84532,
    publicClient: mockPublicClient,
    walletClient: mockWalletClient,
    identityRegistryAddress: REGISTRY_ADDRESS,
  });

  return { client, getWriteArgs: () => writeArgs };
}

describe('ReputationRegistryClient', () => {
  it('reads feedback value and decimals', async () => {
    const { client } = makeClients();

    const feedback = await client.getFeedback(
      1n,
      '0x0000000000000000000000000000000000001111',
      1n
    );

    expect(feedback?.value).toBe(12n);
    expect(feedback?.valueDecimals).toBe(2);
  });

  it('returns summary with value and decimals', async () => {
    const { client } = makeClients();

    const summary = await client.getSummary(1n);

    expect(summary.count).toBe(3n);
    expect(summary.value).toBe(120n);
    expect(summary.valueDecimals).toBe(2);
  });

  it('sends feedback with value and decimals', async () => {
    const { client, getWriteArgs } = makeClients();

    await client.giveFeedback({
      toAgentId: 1n,
      value: 12n,
      valueDecimals: 2,
      tag1: 'tag-a',
      tag2: 'tag-b',
      endpoint: 'https://agent.example.com',
    });

    const writeArgs = getWriteArgs();
    if (!writeArgs) {
      throw new Error('writeContract was not called');
    }
    expect(writeArgs.functionName).toBe('giveFeedback');
    expect(writeArgs.args?.[1]).toBe(12n);
    expect(writeArgs.args?.[2]).toBe(2);
  });

  it('rejects non-integer value inputs', async () => {
    const { client } = makeClients();

    await expect(
      client.giveFeedback({
        toAgentId: 1n,
        value: 1.5,
      })
    ).rejects.toThrow(/safe integer number/);

    await expect(
      client.giveFeedback({
        toAgentId: 1n,
        value: '1.5',
      })
    ).rejects.toThrow(/value must be a base-10 integer string/);
  });

  it('rejects invalid valueDecimals', async () => {
    const { client } = makeClients();

    await expect(
      client.giveFeedback({
        toAgentId: 1n,
        value: 10,
        valueDecimals: -1,
      })
    ).rejects.toThrow(/valueDecimals must be a non-negative integer/);

    await expect(
      client.giveFeedback({
        toAgentId: 1n,
        value: 10,
        valueDecimals: 1.5,
      })
    ).rejects.toThrow(/valueDecimals must be a non-negative integer/);
  });
});
