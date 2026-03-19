import { ethers } from 'ethers';
import { buildSignatureBase, generateNonce } from './utils.js';

export interface SignedRequest {
  signature: string;
  nonce: string;
  signatureHeader: string;
  signerAddress: string;
}

export async function signRequest(
  method: string,
  url: string,
  body: string,
  wallet: ethers.Wallet
): Promise<SignedRequest> {
  const nonce = generateNonce();
  const signatureBase = buildSignatureBase(method, url, body, nonce);

  // Sign with Ethereum wallet (EIP-191 personal sign)
  const signature = await wallet.signMessage(signatureBase);

  const signatureHeader = `sig=:${signature}:; keyid="${wallet.address}"; nonce="${nonce}"`;

  return {
    signature,
    nonce,
    signatureHeader,
    signerAddress: wallet.address,
  };
}

export function createSignedFetch(wallet: ethers.Wallet) {
  return async function signedFetch(
    url: string,
    init: RequestInit = {}
  ): Promise<Response> {
    const method = (init.method || 'GET').toUpperCase();
    const body = typeof init.body === 'string' ? init.body : '';

    const { signatureHeader } = await signRequest(method, url, body, wallet);

    const headers = new Headers(init.headers);
    headers.set('Signature', signatureHeader);

    return fetch(url, { ...init, headers });
  };
}
