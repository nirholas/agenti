import { ethers } from 'ethers';
import { config } from '../../config.js';

const REPUTATION_ABI = [
  {
    inputs: [
      { type: 'uint256', name: 'agentId' },
      { type: 'address[]', name: 'clientAddresses' },
      { type: 'bytes32', name: 'tag1' },
      { type: 'bytes32', name: 'tag2' },
    ],
    name: 'getSummary',
    outputs: [
      { type: 'uint256', name: 'count' },
      { type: 'int128', name: 'summaryValue' },
      { type: 'uint8', name: 'summaryValueDecimals' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { type: 'string', name: 'schemaId' },
      { type: 'uint256', name: 'agentId' },
      { type: 'int128', name: 'value' },
      { type: 'uint8', name: 'valueDecimals' },
      { type: 'bytes32', name: 'tag1' },
      { type: 'bytes32', name: 'tag2' },
      { type: 'string', name: 'ref' },
      { type: 'string', name: 'feedbackURI' },
      { type: 'bytes32', name: 'extraData' },
    ],
    name: 'giveFeedback',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

export function getReputationContract(signerOrProvider: ethers.Wallet | ethers.Provider): ethers.Contract {
  return new ethers.Contract(config.reputationRegistry, REPUTATION_ABI, signerOrProvider);
}

export async function getAgentReputation(
  provider: ethers.Provider,
  agentId: number | string,
  trustedReviewers: string[] = []
): Promise<{ score: number; count: number }> {
  const contract = new ethers.Contract(config.reputationRegistry, REPUTATION_ABI, provider);

  const [count, summaryValue, summaryValueDecimals] = await contract.getSummary(
    agentId,
    trustedReviewers,
    ethers.ZeroHash,
    ethers.ZeroHash
  );

  if (count === 0n) {
    return { score: 0, count: 0 };
  }

  const score = Number(summaryValue) / Math.pow(10, Number(summaryValueDecimals));
  return { score, count: Number(count) };
}

export async function giveFeedback(
  signer: ethers.Wallet,
  agentId: number | string,
  value: number,
  tag1: string,
  tag2: string,
  endpoint: string
): Promise<string> {
  const contract = getReputationContract(signer);

  const schemaId = `eip155:${config.chainId}:${config.identityRegistryAddress}`;
  const tx = await contract.giveFeedback(
    schemaId,
    agentId,
    value,
    0, // valueDecimals
    ethers.encodeBytes32String(tag1),
    ethers.encodeBytes32String(tag2),
    endpoint,
    '', // feedbackURI
    ethers.ZeroHash
  );

  const receipt = await tx.wait();
  return receipt.hash;
}

export { REPUTATION_ABI };
