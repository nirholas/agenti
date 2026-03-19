import { Elysia } from "elysia";

export interface BearerTokenModuleConfig {
  tokens: string[];
  protectedPaths?: string[];
  realm?: string;
}

const DEFAULT_PROTECTED_PATHS = ["/verify", "/settle"];
const DEFAULT_REALM = "facilitator";

function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

function parseRequestPath(request: Request, fallbackPath?: string): string {
  const rawUrl = request.url || "";
  try {
    return normalizePath(new URL(rawUrl).pathname);
  } catch {
    try {
      return normalizePath(new URL(rawUrl, "http://localhost").pathname);
    } catch {
      return normalizePath(fallbackPath ?? "/");
    }
  }
}

function parseBearerAuthorizationHeader(headerValue: string): string | undefined {
  const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
  if (!match) return undefined;
  const token = match[1]?.trim();
  return token || undefined;
}

function matchesProtectedPath(path: string, protectedPaths: string[]): boolean {
  return protectedPaths.some(
    (protectedPath) =>
      path === protectedPath || path.startsWith(`${protectedPath}/`)
  );
}

function escapeRealm(realm: string): string {
  return realm.replace(/"/g, '\\"');
}

export function createBearerTokenModule(
  config: BearerTokenModuleConfig
): unknown {
  const tokens = config.tokens.map((token) => token.trim()).filter(Boolean);
  if (!tokens.length) {
    throw new Error("Bearer auth requires at least one token.");
  }

  const realm = config.realm ?? DEFAULT_REALM;
  const protectedPaths = (config.protectedPaths ?? DEFAULT_PROTECTED_PATHS).map(
    normalizePath
  );
  const validTokens = new Set(tokens);
  const challengeHeader = `Bearer realm="${escapeRealm(realm)}"`;

  return (app: Elysia) =>
    app.onBeforeHandle(({ request, path, set }) => {
      const requestPath = parseRequestPath(request, path);
      if (!matchesProtectedPath(requestPath, protectedPaths)) {
        return;
      }

      const authorizationHeader = request.headers.get("authorization");
      const token = authorizationHeader
        ? parseBearerAuthorizationHeader(authorizationHeader)
        : undefined;

      if (token && validTokens.has(token)) {
        return;
      }

      set.status = 401;
      set.headers["www-authenticate"] = challengeHeader;
      return {
        error: "Unauthorized",
        message: "Valid Bearer token is required",
      };
    });
}
