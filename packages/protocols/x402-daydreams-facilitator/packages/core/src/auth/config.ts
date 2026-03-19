/**
 * Authentication configuration
 */
export interface AuthConfig {
  enabled: boolean;
}

/**
 * Create auth configuration from environment variables
 */
export function createAuthConfig(): AuthConfig {
  return {
    enabled: process.env.AUTH_ENABLED === "true",
  };
}
