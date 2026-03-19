/**
 * Kalshi API authentication helpers (RSA-PSS signing).
 */

import { createSign, constants as cryptoConstants } from 'crypto';

export interface KalshiApiKeyAuth {
  apiKeyId: string;
  privateKeyPem: string;
}

export function normalizeKalshiPrivateKey(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith('-----BEGIN')) {
    return trimmed;
  }

  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8').trim();
    if (decoded.startsWith('-----BEGIN')) {
      return decoded;
    }
  } catch {
    // fall through
  }

  return trimmed;
}

export function buildKalshiSignature(
  auth: KalshiApiKeyAuth,
  method: string,
  pathWithoutQuery: string,
  timestampMs: number
): string {
  const message = `${timestampMs}${method.toUpperCase()}${pathWithoutQuery}`;
  const signer = createSign('RSA-SHA256');
  signer.update(message);
  signer.end();

  const signature = signer.sign({
    key: normalizeKalshiPrivateKey(auth.privateKeyPem),
    padding: cryptoConstants.RSA_PKCS1_PSS_PADDING,
    saltLength: cryptoConstants.RSA_PSS_SALTLEN_DIGEST,
  });

  return signature.toString('base64');
}

export function buildKalshiHeadersForUrl(
  auth: KalshiApiKeyAuth,
  method: string,
  url: string,
  timestampMs = Date.now()
): Record<string, string> {
  const parsed = new URL(url);
  const path = parsed.pathname;
  const signature = buildKalshiSignature(auth, method, path, timestampMs);

  return {
    'KALSHI-ACCESS-KEY': auth.apiKeyId,
    'KALSHI-ACCESS-TIMESTAMP': timestampMs.toString(),
    'KALSHI-ACCESS-SIGNATURE': signature,
  };
}
