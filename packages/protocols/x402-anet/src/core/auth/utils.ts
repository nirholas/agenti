import crypto from 'crypto';

export function createContentDigest(body: string): string {
  const hash = crypto.createHash('sha256').update(body).digest('base64');
  return `sha-256=:${hash}:`;
}

export function buildSignatureBase(
  method: string,
  url: string,
  body: string,
  nonce: string
): string {
  const parsedUrl = new URL(url);
  return [
    `@method: ${method}`,
    `@path: ${parsedUrl.pathname}`,
    `@query: ${parsedUrl.search}`,
    `content-digest: ${createContentDigest(body)}`,
    `nonce: ${nonce}`,
  ].join('\n');
}

export function parseSignatureHeader(header: string): {
  signature?: string;
  keyId?: string;
  nonce?: string;
} {
  const sigMatch = header.match(/sig=:([^:]+):/);
  const keyidMatch = header.match(/keyid="([^"]+)"/);
  const nonceMatch = header.match(/nonce="([^"]+)"/);

  return {
    signature: sigMatch?.[1],
    keyId: keyidMatch?.[1],
    nonce: nonceMatch?.[1],
  };
}

export function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}
