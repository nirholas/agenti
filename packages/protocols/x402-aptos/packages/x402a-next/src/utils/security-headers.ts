export interface SecurityHeadersConfig {
  /** Enable Content Security Policy */
  csp?: boolean;
  /** Custom CSP directives */
  cspDirectives?: Record<string, string[]>;
  /** Enable X-Frame-Options */
  frameOptions?: "DENY" | "SAMEORIGIN" | false;
  /** Enable X-Content-Type-Options */
  contentTypeOptions?: boolean;
  /** Enable Strict-Transport-Security (HSTS) */
  hsts?: boolean;
  /** HSTS max-age in seconds (default: 1 year) */
  hstsMaxAge?: number;
  /** Enable X-XSS-Protection */
  xssProtection?: boolean;
  /** Enable Referrer-Policy */
  referrerPolicy?:
    | "no-referrer"
    | "no-referrer-when-downgrade"
    | "origin"
    | "origin-when-cross-origin"
    | "same-origin"
    | "strict-origin"
    | "strict-origin-when-cross-origin"
    | "unsafe-url"
    | false;
  /** Enable Permissions-Policy */
  permissionsPolicy?: boolean;
  /** Custom Permissions-Policy directives */
  permissionsPolicyDirectives?: Record<string, string[]>;
}

const DEFAULT_CONFIG: SecurityHeadersConfig = {
  csp: true,
  frameOptions: "DENY",
  contentTypeOptions: true,
  hsts: true,
  hstsMaxAge: 31536000, // 1 year
  xssProtection: true,
  referrerPolicy: "strict-origin-when-cross-origin",
  permissionsPolicy: true,
};

const DEFAULT_CSP_DIRECTIVES: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Relaxed for Next.js
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "https:"],
  "font-src": ["'self'", "data:"],
  "connect-src": ["'self'", "https://*.aptoslabs.com"],
  "frame-ancestors": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
};

const DEFAULT_PERMISSIONS_POLICY: Record<string, string[]> = {
  camera: ["'none'"],
  microphone: ["'none'"],
  geolocation: ["'none'"],
  payment: ["'self'"],
};

function buildCSP(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");
}

function buildPermissionsPolicy(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([key, values]) => `${key}=(${values.join(" ")})`)
    .join(", ");
}

export function getSecurityHeaders(config: SecurityHeadersConfig = {}): Record<string, string> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const headers: Record<string, string> = {};

  if (fullConfig.csp) {
    const cspDirectives = {
      ...DEFAULT_CSP_DIRECTIVES,
      ...fullConfig.cspDirectives,
    };
    headers["Content-Security-Policy"] = buildCSP(cspDirectives);
  }

  if (fullConfig.frameOptions) {
    headers["X-Frame-Options"] = fullConfig.frameOptions;
  }

  if (fullConfig.contentTypeOptions) {
    headers["X-Content-Type-Options"] = "nosniff";
  }

  if (fullConfig.hsts) {
    const maxAge = fullConfig.hstsMaxAge || 31536000;
    headers["Strict-Transport-Security"] = `max-age=${maxAge}; includeSubDomains; preload`;
  }

  if (fullConfig.xssProtection) {
    headers["X-XSS-Protection"] = "1; mode=block";
  }

  if (fullConfig.referrerPolicy) {
    headers["Referrer-Policy"] = fullConfig.referrerPolicy;
  }

  if (fullConfig.permissionsPolicy) {
    const permissionsDirectives = {
      ...DEFAULT_PERMISSIONS_POLICY,
      ...fullConfig.permissionsPolicyDirectives,
    };
    headers["Permissions-Policy"] = buildPermissionsPolicy(permissionsDirectives);
  }

  return headers;
}

export function applySecurityHeaders(response: Response, config?: SecurityHeadersConfig): Response {
  const headers = getSecurityHeaders(config);
  const newResponse = new Response(response.body, response);

  for (const [key, value] of Object.entries(headers)) {
    newResponse.headers.set(key, value);
  }

  return newResponse;
}

export function createSecurityHeadersMiddleware(config?: SecurityHeadersConfig) {
  return function applyHeaders(response: Response): Response {
    return applySecurityHeaders(response, config);
  };
}

export const STRICT_SECURITY: SecurityHeadersConfig = {
  csp: true,
  cspDirectives: {
    "default-src": ["'self'"],
    "script-src": ["'self'"],
    "style-src": ["'self'"],
    "img-src": ["'self'", "data:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", "https://*.aptoslabs.com"],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  },
  frameOptions: "DENY",
  contentTypeOptions: true,
  hsts: true,
  hstsMaxAge: 63072000, // 2 years
  xssProtection: true,
  referrerPolicy: "no-referrer",
  permissionsPolicy: true,
};

export const DEV_SECURITY: SecurityHeadersConfig = {
  csp: true,
  cspDirectives: {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "https:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", "https:", "ws:", "wss:"],
    "frame-ancestors": ["'self'"],
  },
  frameOptions: "SAMEORIGIN",
  contentTypeOptions: true,
  hsts: false,
  xssProtection: true,
  referrerPolicy: "strict-origin-when-cross-origin",
  permissionsPolicy: false,
};
