import { ethers } from 'ethers';
import fs from 'fs';
import { config } from '../../config.js';

const IDENTITY_REGISTRY_ABI = [
  // Functions
  {
    inputs: [{ type: 'string', name: 'agentURI' }],
    name: 'register',
    outputs: [{ type: 'uint256', name: 'agentId' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { type: 'uint256', name: 'agentId' },
      { type: 'string', name: 'metadataKey' },
      { type: 'bytes', name: 'metadataValue' },
    ],
    name: 'setMetadata',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { type: 'uint256', name: 'agentId' },
      { type: 'string', name: 'metadataKey' },
    ],
    name: 'getMetadata',
    outputs: [{ type: 'bytes', name: '' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { type: 'uint256', name: 'agentId' },
      { type: 'address', name: 'newWallet' },
      { type: 'uint256', name: 'deadline' },
      { type: 'bytes', name: 'signature' },
    ],
    name: 'setAgentWallet',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ type: 'uint256', name: 'agentId' }],
    name: 'getAgentWallet',
    outputs: [{ type: 'address', name: '' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ type: 'uint256', name: 'tokenId' }],
    name: 'tokenURI',
    outputs: [{ type: 'string', name: '' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ type: 'uint256', name: 'tokenId' }],
    name: 'ownerOf',
    outputs: [{ type: 'address', name: '' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Events (parameter order matches actual contract)
  {
    anonymous: false,
    inputs: [
      { indexed: true, type: 'address', name: 'from' },
      { indexed: true, type: 'address', name: 'to' },
      { indexed: true, type: 'uint256', name: 'tokenId' },
    ],
    name: 'Transfer',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, type: 'uint256', name: 'agentId' },
      { indexed: false, type: 'string', name: 'agentURI' },
      { indexed: true, type: 'address', name: 'owner' },
    ],
    name: 'Registered',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, type: 'uint256', name: 'agentId' },
      { indexed: true, type: 'string', name: 'indexedMetadataKey' },
      { indexed: false, type: 'string', name: 'metadataKey' },
      { indexed: false, type: 'bytes', name: 'metadataValue' },
    ],
    name: 'MetadataSet',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, type: 'uint256', name: 'agentId' },
      { indexed: false, type: 'string', name: 'newURI' },
      { indexed: true, type: 'address', name: 'updatedBy' },
    ],
    name: 'URIUpdated',
    type: 'event',
  },
];

export function getIdentityRegistryContract(signer: ethers.Wallet): ethers.Contract {
  return new ethers.Contract(config.identityRegistryAddress, IDENTITY_REGISTRY_ABI, signer);
}

export async function registerAgent(
  signer: ethers.Wallet,
  agentURI: string
): Promise<{ agentId: string; txHash: string }> {
  const contract = getIdentityRegistryContract(signer);

  console.log(`Registering agent with URI: ${agentURI}`);
  console.log(`Registry: ${config.identityRegistryAddress}`);
  console.log(`Network: ${config.network}`);

  const tx = await contract.register(agentURI);
  console.log(`Transaction submitted: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

  // Parse agentId from Registered event
  const registeredEvent = receipt.logs.find(
    (log: ethers.Log) => {
      try {
        const parsed = contract.interface.parseLog({ topics: log.topics as string[], data: log.data });
        return parsed?.name === 'Registered';
      } catch { return false; }
    }
  );

  let agentId = '0';
  if (registeredEvent) {
    const parsed = contract.interface.parseLog({
      topics: registeredEvent.topics as string[],
      data: registeredEvent.data,
    });
    agentId = parsed?.args?.agentId?.toString() || '0';
  }

  return { agentId, txHash: receipt.hash };
}

export async function setAgentMetadata(
  signer: ethers.Wallet,
  agentId: string,
  key: string,
  value: string
): Promise<string> {
  const contract = getIdentityRegistryContract(signer);
  const metadataValue = ethers.toUtf8Bytes(value);

  const tx = await contract.setMetadata(agentId, key, metadataValue);
  const receipt = await tx.wait();
  return receipt.hash;
}

export interface RegistrationData {
  agentId: string;
  agentURI: string;
  registeredAt: string;
  registryAddress: string;
  txHash: string;
  network: string;
}

export function saveRegistration(data: RegistrationData, filePath: string): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function loadRegistration(filePath: string): RegistrationData {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export { IDENTITY_REGISTRY_ABI };
