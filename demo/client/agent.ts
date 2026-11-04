/**
 * Browser-side agent wallet and x402 signer. Bundled to /app/agent.js.
 * Private keys are generated and used only in the page; nothing here talks to the server.
 */
import { ed25519 } from '@noble/curves/ed25519.js';
import { base58 } from '@scure/base';
import { getAddress, isHex, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

export interface GeneratedWallet {
  address: string;
  chain: 'evm' | 'sol';
  /** EVM: 0x-prefixed 32-byte hex. Solana: base58 of the 64-byte secret‖public key (Phantom / solana-keygen format). */
  secret: string;
}

export function generateEvm(): GeneratedWallet {
  const secret = generatePrivateKey();
  return { address: privateKeyToAccount(secret).address, chain: 'evm', secret };
}

export function generateSol(): GeneratedWallet {
  const { publicKey, secretKey } = ed25519.keygen();
  const full = new Uint8Array(64);
  full.set(secretKey, 0);
  full.set(publicKey, 32);
  return { address: base58.encode(publicKey), chain: 'sol', secret: base58.encode(full) };
}

/** Normalizes a pasted EVM private key and returns its address; throws a readable error when malformed. */
export function evmKeyAddress(raw: string): { address: string; key: Hex } {
  const v = raw.trim();
  const key = (v.startsWith('0x') ? v : `0x${v}`) as Hex;
  if (!isHex(key) || key.length !== 66) throw new Error('Private key must be 32 bytes of hex (64 characters, optional 0x prefix)');
  return { address: privateKeyToAccount(key).address, key };
}

export interface PayOption {
  amount: string;
  asset: string;
  chainId: number;
  extra: { name: string; version: string } & Record<string, unknown>;
  maxTimeoutSeconds: number;
  network: string;
  payTo: string;
  raw: Record<string, unknown>;
  scheme: string;
}

export interface PayResource {
  description: string;
  mimeType: string;
  url: string;
}

interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

export type Signer = { key: string; kind: 'key' } | { kind: 'wallet'; provider: Eip1193 };

export interface SignedPayment {
  from: string;
  header: 'PAYMENT-SIGNATURE' | 'X-PAYMENT';
  payload: Record<string, unknown>;
  value: string;
}

const TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

const EIP712_DOMAIN = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
];

const randomNonce = (): Hex => `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('')}`;

function b64json(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

async function walletAccount(provider: Eip1193): Promise<string> {
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
  if (!accounts?.[0]) throw new Error('The wallet did not return an account');
  return getAddress(accounts[0]);
}

/**
 * Signs an EIP-3009 TransferWithAuthorization for an x402 `exact` requirement and encodes the payment header.
 * The wallet path expects the wallet to already be on `option.chainId` (call switchEvmChain first).
 */
export async function signPayment(signer: Signer, option: PayOption, resource: PayResource, version: 1 | 2): Promise<SignedPayment> {
  if (option.scheme !== 'exact') throw new Error(`Scheme "${option.scheme}" cannot be signed here`);
  const now = Math.floor(Date.now() / 1000);
  const from = signer.kind === 'key' ? evmKeyAddress(signer.key).address : await walletAccount(signer.provider);
  const authorization = {
    from,
    nonce: randomNonce(),
    to: getAddress(option.payTo),
    validAfter: String(now - 600),
    validBefore: String(now + Math.max(60, option.maxTimeoutSeconds)),
    value: option.amount,
  };
  const domain = { chainId: option.chainId, name: option.extra.name, verifyingContract: getAddress(option.asset), version: option.extra.version };
  let signature: string;
  if (signer.kind === 'key') {
    const account = privateKeyToAccount(evmKeyAddress(signer.key).key);
    signature = await account.signTypedData({
      domain,
      message: {
        from: authorization.from as Hex,
        nonce: authorization.nonce,
        to: authorization.to as Hex,
        validAfter: BigInt(authorization.validAfter),
        validBefore: BigInt(authorization.validBefore),
        value: BigInt(authorization.value),
      },
      primaryType: 'TransferWithAuthorization',
      types: TYPES,
    });
  } else {
    const typed = { domain, message: authorization, primaryType: 'TransferWithAuthorization', types: { EIP712Domain: EIP712_DOMAIN, ...TYPES } };
    signature = (await signer.provider.request({ method: 'eth_signTypedData_v4', params: [from, JSON.stringify(typed)] })) as string;
  }
  const inner = { authorization, signature };
  const payload: Record<string, unknown> =
    version === 2
      ? { accepted: option.raw, payload: inner, resource, x402Version: 2 }
      : { network: option.network, payload: inner, scheme: option.scheme, x402Version: 1 };
  return { from, header: version === 2 ? 'PAYMENT-SIGNATURE' : 'X-PAYMENT', payload, value: b64json(payload) };
}
