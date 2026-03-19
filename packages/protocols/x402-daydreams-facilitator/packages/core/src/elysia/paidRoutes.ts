import type { RouteConfig, RoutesConfig } from "@x402/core/http";
import type { x402ResourceServer, FacilitatorClient } from "@x402/core/server";
import {
  createElysiaPaymentMiddleware,
  type ElysiaPaymentMiddlewareConfig,
} from "./middleware.js";

type HttpMethod =
  | "get"
  | "post"
  | "put"
  | "patch"
  | "delete"
  | "options"
  | "head"
  | "all"
  | "connect";

type RouteHandler = (...args: Array<unknown>) => unknown;
type RouteHook = Record<string, unknown>;

type RouteRegistrar = {
  [Key in HttpMethod]?: (
    path: string,
    handler: RouteHandler,
    hook?: RouteHook
  ) => RouteRegistrar;
};

type ElysiaRouteRegistrar = RouteRegistrar & {
  use: (plugin: unknown) => unknown;
};

export interface PaidRouteHook extends RouteHook {
  payment?: RouteConfig;
}

export interface PaidRoutesOptions {
  basePath?: string;
}

export interface PaidRoutes {
  routes: RoutesConfig;
  apply(app: RouteRegistrar): RouteRegistrar;
  get(path: string, handler: RouteHandler, hook?: PaidRouteHook): PaidRoutes;
  post(path: string, handler: RouteHandler, hook?: PaidRouteHook): PaidRoutes;
  put(path: string, handler: RouteHandler, hook?: PaidRouteHook): PaidRoutes;
  patch(path: string, handler: RouteHandler, hook?: PaidRouteHook): PaidRoutes;
  delete(path: string, handler: RouteHandler, hook?: PaidRouteHook): PaidRoutes;
  options(path: string, handler: RouteHandler, hook?: PaidRouteHook): PaidRoutes;
  head(path: string, handler: RouteHandler, hook?: PaidRouteHook): PaidRoutes;
  all(path: string, handler: RouteHandler, hook?: PaidRouteHook): PaidRoutes;
  connect(path: string, handler: RouteHandler, hook?: PaidRouteHook): PaidRoutes;
}

export interface ElysiaPaidRoutesOptions extends PaidRoutesOptions {
  middleware: Omit<
    ElysiaPaymentMiddlewareConfig,
    "routes" | "httpServer" | "routesResolver"
  > &
    (
      | { resourceServer: x402ResourceServer }
      | { facilitatorClient: FacilitatorClient }
    );
}

export interface ElysiaPaidRoutes {
  app: ElysiaRouteRegistrar;
  routes: RoutesConfig;
  get(path: string, handler: RouteHandler, hook?: PaidRouteHook): ElysiaPaidRoutes;
  post(
    path: string,
    handler: RouteHandler,
    hook?: PaidRouteHook
  ): ElysiaPaidRoutes;
  put(path: string, handler: RouteHandler, hook?: PaidRouteHook): ElysiaPaidRoutes;
  patch(
    path: string,
    handler: RouteHandler,
    hook?: PaidRouteHook
  ): ElysiaPaidRoutes;
  delete(
    path: string,
    handler: RouteHandler,
    hook?: PaidRouteHook
  ): ElysiaPaidRoutes;
  options(
    path: string,
    handler: RouteHandler,
    hook?: PaidRouteHook
  ): ElysiaPaidRoutes;
  head(path: string, handler: RouteHandler, hook?: PaidRouteHook): ElysiaPaidRoutes;
  all(path: string, handler: RouteHandler, hook?: PaidRouteHook): ElysiaPaidRoutes;
  connect(
    path: string,
    handler: RouteHandler,
    hook?: PaidRouteHook
  ): ElysiaPaidRoutes;
}

interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
  hook?: RouteHook;
}

function normalizeBasePath(basePath: string | undefined): string {
  if (!basePath) return "";
  if (basePath === "/") return "";
  const trimmed = basePath.trim();
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.endsWith("/") ? withSlash.slice(0, -1) : withSlash;
}

function normalizeRoutePath(path: string): string {
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  if (withSlash.length > 1 && withSlash.endsWith("/")) {
    return withSlash.slice(0, -1);
  }
  return withSlash;
}

function joinPaths(basePath: string, path: string): string {
  const normalizedPath = normalizeRoutePath(path);
  if (!basePath) return normalizedPath;
  if (normalizedPath === "/") return basePath;
  return `${basePath}${normalizedPath}`;
}

function toX402RoutePattern(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, "[$1]");
}

function registerPaymentConfig(
  basePath: string,
  routes: Record<string, RouteConfig>,
  method: HttpMethod,
  path: string,
  hook?: PaidRouteHook
): RouteHook | undefined {
  const { payment, ...rest } = (hook ?? {}) as PaidRouteHook;
  const cleanedHook = Object.keys(rest).length > 0 ? rest : undefined;

  if (payment) {
    const fullPath = joinPaths(basePath, path);
    const routeKey = `${method.toUpperCase()} ${toX402RoutePattern(fullPath)}`;

    if (routes[routeKey]) {
      throw new Error(`Duplicate payment config for ${routeKey}`);
    }

    routes[routeKey] = payment;
  }

  return cleanedHook;
}

export function createPaidRoutes(options: PaidRoutesOptions = {}): PaidRoutes {
  const basePath = normalizeBasePath(options.basePath);
  const routes: Record<string, RouteConfig> = {};
  const definitions: Array<RouteDefinition> = [];

  const register = (
    method: HttpMethod,
    path: string,
    handler: RouteHandler,
    hook?: PaidRouteHook
  ): PaidRoutes => {
    const cleanedHook = registerPaymentConfig(
      basePath,
      routes,
      method,
      path,
      hook
    );

    definitions.push({ method, path, handler, hook: cleanedHook });
    return api;
  };

  const apply = (app: RouteRegistrar): RouteRegistrar => {
    for (const definition of definitions) {
      const registrar = app[definition.method];
      if (typeof registrar !== "function") {
        throw new Error(
          `Route registrar missing method '${definition.method}' for ${definition.path}`
        );
      }
      app[definition.method]?.(
        definition.path,
        definition.handler,
        definition.hook
      );
    }
    return app;
  };

  const api: PaidRoutes = {
    routes,
    apply,
    get: (path, handler, hook) => register("get", path, handler, hook),
    post: (path, handler, hook) => register("post", path, handler, hook),
    put: (path, handler, hook) => register("put", path, handler, hook),
    patch: (path, handler, hook) => register("patch", path, handler, hook),
    delete: (path, handler, hook) => register("delete", path, handler, hook),
    options: (path, handler, hook) => register("options", path, handler, hook),
    head: (path, handler, hook) => register("head", path, handler, hook),
    all: (path, handler, hook) => register("all", path, handler, hook),
    connect: (path, handler, hook) => register("connect", path, handler, hook),
  };

  return api;
}

export function createElysiaPaidRoutes(
  app: ElysiaRouteRegistrar,
  options: ElysiaPaidRoutesOptions
): ElysiaPaidRoutes {
  const basePath = normalizeBasePath(options.basePath);
  const routes: Record<string, RouteConfig> = {};

  const middlewareConfig: ElysiaPaymentMiddlewareConfig = {
    ...options.middleware,
    routesResolver: () => routes,
  };

  app.use(createElysiaPaymentMiddleware(middlewareConfig));

  const register = (
    method: HttpMethod,
    path: string,
    handler: RouteHandler,
    hook?: PaidRouteHook
  ): ElysiaPaidRoutes => {
    const cleanedHook = registerPaymentConfig(
      basePath,
      routes,
      method,
      path,
      hook
    );

    const registrar = app[method];
    if (typeof registrar !== "function") {
      throw new Error(
        `Route registrar missing method '${method}' for ${path}`
      );
    }

    registrar.call(app, path, handler, cleanedHook);
    return api;
  };

  const api: ElysiaPaidRoutes = {
    app,
    routes,
    get: (path, handler, hook) => register("get", path, handler, hook),
    post: (path, handler, hook) => register("post", path, handler, hook),
    put: (path, handler, hook) => register("put", path, handler, hook),
    patch: (path, handler, hook) => register("patch", path, handler, hook),
    delete: (path, handler, hook) => register("delete", path, handler, hook),
    options: (path, handler, hook) => register("options", path, handler, hook),
    head: (path, handler, hook) => register("head", path, handler, hook),
    all: (path, handler, hook) => register("all", path, handler, hook),
    connect: (path, handler, hook) => register("connect", path, handler, hook),
  };

  return api;
}
