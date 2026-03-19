import { ethers } from 'ethers';
import { buildSignatureBase, parseSignatureHeader } from './utils.js';
import type { Request } from 'express';

export interface VerificationResult {
  valid: boolean;
  address?: string;
  error?: string;
}

export async function verifySignature(req: Request): Promise<VerificationResult> {
  const signatureHeader = req.headers['signature'] as string;

  if (!signatureHeader) {
    return { valid: false, error: 'Missing Signature header' };
  }

  const { signature, keyId, nonce } = parseSignatureHeader(signatureHeader);

  if (!signature || !keyId || !nonce) {
    return { valid: false, error: 'Malformed Signature header' };
  }

  try {
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || '');
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const signatureBase = buildSignatureBase(req.method, url, body, nonce);

    const recoveredAddress = ethers.verifyMessage(signatureBase, signature);

    if (recoveredAddress.toLowerCase() === keyId.toLowerCase()) {
      return { valid: true, address: recoveredAddress };
    }

    return { valid: false, error: 'Signature mismatch' };
  } catch (error) {
    return { valid: false, error: `Verification failed: ${error}` };
  }
}
