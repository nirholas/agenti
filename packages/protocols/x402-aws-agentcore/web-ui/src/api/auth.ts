/**
 * Authentication Service for AgentCore Gateway
 * 
 * This module provides authentication utilities for browser-based access
 * to the AgentCore Gateway. It supports multiple authentication methods:
 * 
 * 1. Cognito Identity Pool - For production browser environments
 * 2. Proxy Mode - For development with a backend proxy handling SigV4
 * 3. API Key - For simple API Gateway authentication
 * 
 * Browser environments cannot directly use IAM SigV4 signing because
 * it requires AWS credentials that should never be exposed client-side.
 * Instead, we use AWS Cognito to obtain temporary credentials.
 */

import { sha256 } from './crypto-utils';

export type AuthMethod = 'cognito' | 'proxy' | 'api-key' | 'none';

export interface AuthConfig {
  /** Authentication method to use */
  method: AuthMethod;
  /** AWS region */
  region: string;
  /** Cognito Identity Pool ID (for cognito method) */
  identityPoolId?: string;
  /** Cognito User Pool ID (for authenticated users) */
  userPoolId?: string;
  /** Cognito User Pool Client ID */
  userPoolClientId?: string;
  /** API Key (for api-key method) */
  apiKey?: string;
  /** Proxy endpoint (for proxy method) */
  proxyEndpoint?: string;
}

export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  expiration?: Date;
}

export interface AuthHeaders {
  [key: string]: string;
}

/**
 * Authentication Service for managing Gateway authentication
 */
export class AuthService {
  private config: AuthConfig;
  private credentials: AWSCredentials | null = null;
  private credentialsExpiry: Date | null = null;
  private refreshPromise: Promise<AWSCredentials> | null = null;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  /**
   * Get the current authentication method
   */
  getMethod(): AuthMethod {
    return this.config.method;
  }

  /**
   * Check if credentials are valid and not expired
   */
  hasValidCredentials(): boolean {
    if (!this.credentials || !this.credentialsExpiry) {
      return false;
    }
    // Consider credentials expired 5 minutes before actual expiry
    const bufferMs = 5 * 60 * 1000;
    return this.credentialsExpiry.getTime() - bufferMs > Date.now();
  }

  /**
   * Get authentication headers for a request
   */
  async getAuthHeaders(
    method: string,
    url: string,
    body?: string
  ): Promise<AuthHeaders> {
    switch (this.config.method) {
      case 'cognito':
        return this.getCognitoAuthHeaders(method, url, body);
      case 'api-key':
        return this.getApiKeyHeaders();
      case 'proxy':
        return this.getProxyHeaders();
      case 'none':
      default:
        return {};
    }
  }

  /**
   * Get headers for Cognito-based authentication with SigV4
   */
  private async getCognitoAuthHeaders(
    method: string,
    url: string,
    body?: string
  ): Promise<AuthHeaders> {
    const credentials = await this.getCredentials();
    return this.signRequest(method, url, body || '', credentials);
  }

  /**
   * Get headers for API Key authentication
   */
  private getApiKeyHeaders(): AuthHeaders {
    if (!this.config.apiKey) {
      throw new Error('API key not configured');
    }
    return {
      'x-api-key': this.config.apiKey,
    };
  }

  /**
   * Get headers for proxy mode (no auth headers needed, proxy handles it)
   */
  private getProxyHeaders(): AuthHeaders {
    return {
      'X-Proxy-Auth': 'true',
    };
  }

  /**
   * Get or refresh AWS credentials from Cognito
   */
  async getCredentials(): Promise<AWSCredentials> {
    // Return cached credentials if valid
    if (this.hasValidCredentials() && this.credentials) {
      return this.credentials;
    }

    // If already refreshing, wait for that promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Start refresh
    this.refreshPromise = this.refreshCredentials();
    
    try {
      this.credentials = await this.refreshPromise;
      return this.credentials;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Refresh credentials from Cognito Identity Pool
   */
  private async refreshCredentials(): Promise<AWSCredentials> {
    if (!this.config.identityPoolId) {
      throw new Error('Cognito Identity Pool ID not configured');
    }

    try {
      // Get identity ID from Cognito Identity Pool
      const identityResponse = await fetch(
        `https://cognito-identity.${this.config.region}.amazonaws.com/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': 'AWSCognitoIdentityService.GetId',
          },
          body: JSON.stringify({
            IdentityPoolId: this.config.identityPoolId,
          }),
        }
      );

      if (!identityResponse.ok) {
        const error = await identityResponse.text();
        throw new Error(`Failed to get identity: ${error}`);
      }

      const identityData = await identityResponse.json();
      const identityId = identityData.IdentityId;

      // Get credentials for the identity
      const credentialsResponse = await fetch(
        `https://cognito-identity.${this.config.region}.amazonaws.com/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': 'AWSCognitoIdentityService.GetCredentialsForIdentity',
          },
          body: JSON.stringify({
            IdentityId: identityId,
          }),
        }
      );

      if (!credentialsResponse.ok) {
        const error = await credentialsResponse.text();
        throw new Error(`Failed to get credentials: ${error}`);
      }

      const credentialsData = await credentialsResponse.json();
      const creds = credentialsData.Credentials;

      this.credentialsExpiry = new Date(creds.Expiration * 1000);

      return {
        accessKeyId: creds.AccessKeyId,
        secretAccessKey: creds.SecretKey,
        sessionToken: creds.SessionToken,
        expiration: this.credentialsExpiry,
      };
    } catch (error) {
      console.error('Failed to refresh Cognito credentials:', error);
      throw error;
    }
  }

  /**
   * Sign a request using AWS SigV4
   */
  private async signRequest(
    method: string,
    url: string,
    body: string,
    credentials: AWSCredentials
  ): Promise<AuthHeaders> {
    const service = 'bedrock-agent-runtime';
    const parsedUrl = new URL(url);
    const host = parsedUrl.host;
    const path = parsedUrl.pathname || '/';
    const queryString = parsedUrl.search.slice(1);

    // Get current timestamp
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    // Create headers object
    const headers: AuthHeaders = {
      'host': host,
      'x-amz-date': amzDate,
      'content-type': 'application/json',
    };

    if (credentials.sessionToken) {
      headers['x-amz-security-token'] = credentials.sessionToken;
    }

    // Calculate payload hash
    const payloadHash = await sha256(body);
    headers['x-amz-content-sha256'] = payloadHash;

    // Create canonical request
    const signedHeaders = Object.keys(headers).sort().join(';');
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map(key => `${key}:${headers[key]}\n`)
      .join('');

    const canonicalRequest = [
      method,
      path,
      queryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    // Create string to sign
    const credentialScope = `${dateStamp}/${this.config.region}/${service}/aws4_request`;
    const canonicalRequestHash = await sha256(canonicalRequest);
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      canonicalRequestHash,
    ].join('\n');

    // Calculate signature
    const signature = await this.calculateSignature(
      credentials.secretAccessKey,
      dateStamp,
      this.config.region,
      service,
      stringToSign
    );

    // Create authorization header
    headers['authorization'] = [
      `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`,
    ].join(', ');

    return headers;
  }

  /**
   * Calculate SigV4 signature
   */
  private async calculateSignature(
    secretKey: string,
    dateStamp: string,
    region: string,
    service: string,
    stringToSign: string
  ): Promise<string> {
    const { hmacSha256 } = await import('./crypto-utils');
    
    const kDate = await hmacSha256(`AWS4${secretKey}`, dateStamp);
    const kRegion = await hmacSha256(kDate, region);
    const kService = await hmacSha256(kRegion, service);
    const kSigning = await hmacSha256(kService, 'aws4_request');
    
    const signature = await hmacSha256(kSigning, stringToSign, 'hex');
    return signature as string;
  }

  /**
   * Clear cached credentials
   */
  clearCredentials(): void {
    this.credentials = null;
    this.credentialsExpiry = null;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AuthConfig>): void {
    this.config = { ...this.config, ...config };
    this.clearCredentials();
  }
}

/**
 * Create an AuthService with configuration from environment
 */
export function createAuthService(config?: Partial<AuthConfig>): AuthService {
  const defaultConfig: AuthConfig = {
    method: (import.meta.env.VITE_AUTH_METHOD as AuthMethod) || 'proxy',
    region: import.meta.env.VITE_AWS_REGION || 'us-west-2',
    identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID,
    userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
    userPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
    apiKey: import.meta.env.VITE_API_KEY,
    proxyEndpoint: import.meta.env.VITE_PROXY_ENDPOINT,
  };

  return new AuthService({ ...defaultConfig, ...config });
}

export default AuthService;
