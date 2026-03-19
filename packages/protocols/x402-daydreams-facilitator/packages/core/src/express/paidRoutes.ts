import type { Router, RequestHandler, Application } from "express";
import type { RouteConfig, RoutesConfig } from "@x402/core/http";
import type { x402ResourceServer, FacilitatorClient } from "@x402/core/server";
import {
  createExpressPaymentMiddleware,
  type ExpressPaymentMiddlewareConfig,
} from "./middleware.js";

type HttpMethod =
  | "get"
  | "post"
  | "put"
  | "patch"
  | "delete"
  | "options"
  | "head"
  | "all";

export interface PaidRouteOptions {
  payment?: RouteConfig;
}

export interface PaidRoutesOptions {
  basePath?: string;
}

export interface PaidRoutes {
  routes: RoutesConfig;
  apply(router: Router): Router;
  get(path: string, ...handlers: RequestHandler[]): PaidRoutes;
  post(path: string, ...handlers: RequestHandler[]): PaidRoutes;
  put(path: string, ...handlers: RequestHandler[]): PaidRoutes;
  patch(path: string, ...handlers: RequestHandler[]): PaidRoutes;
  delete(path: string, ...handlers: RequestHandler[]): PaidRoutes;
  options(path: string, ...handlers: RequestHandler[]): PaidRoutes;
  head(path: string, ...handlers: RequestHandler[]): PaidRoutes;
  all(path: string, ...handlers: RequestHandler[]): PaidRoutes;
  withPayment(payment: RouteConfig): {
    get(path: string, ...handlers: RequestHandler[]): PaidRoutes;
    post(path: string, ...handlers: RequestHandler[]): PaidRoutes;
    put(path: string, ...handlers: RequestHandler[]): PaidRoutes;
    patch(path: string, ...handlers: RequestHandler[]): PaidRoutes;
    delete(path: string, ...handlers: RequestHandler[]): PaidRoutes;
    options(path: string, ...handlers: RequestHandler[]): PaidRoutes;
    head(path: string, ...handlers: RequestHandler[]): PaidRoutes;
    all(path: string, ...handlers: RequestHandler[]): PaidRoutes;
  };
}

export interface ExpressPaidRoutesOptions extends PaidRoutesOptions {
  middleware: Omit<ExpressPaymentMiddlewareConfig, "routes" | "httpServer"> &
    (
      | { resourceServer: x402ResourceServer }
      | { facilitatorClient: FacilitatorClient }
    );
}

export interface ExpressPaidRoutes {
  app: Application | Router;
  routes: RoutesConfig;
  get(
    path: string,
    handler: RequestHandler,
    options?: PaidRouteOptions
  ): ExpressPaidRoutes;
  post(
    path: string,
    handler: RequestHandler,
    options?: PaidRouteOptions
  ): ExpressPaidRoutes;
  put(
    path: string,
    handler: RequestHandler,
    options?: PaidRouteOptions
  ): ExpressPaidRoutes;
  patch(
    path: string,
    handler: RequestHandler,
    options?: PaidRouteOptions
  ): ExpressPaidRoutes;
  delete(
    path: string,
    handler: RequestHandler,
    options?: PaidRouteOptions
  ): ExpressPaidRoutes;
  options(
    path: string,
    handler: RequestHandler,
    options?: PaidRouteOptions
  ): ExpressPaidRoutes;
  head(
    path: string,
    handler: RequestHandler,
    options?: PaidRouteOptions
  ): ExpressPaidRoutes;
  all(
    path: string,
    handler: RequestHandler,
    options?: PaidRouteOptions
  ): ExpressPaidRoutes;
}

interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handlers: RequestHandler[];
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
  // Express uses :param, x402 uses [param]
  return path.replace(/:([A-Za-z0-9_]+)/g, "[$1]");
}

function registerPaymentConfig(
  basePath: string,
  routes: Record<string, RouteConfig>,
  method: HttpMethod,
  path: string,
  payment?: RouteConfig
): void {
  if (payment) {
    const fullPath = joinPaths(basePath, path);
    const routeKey = `${method.toUpperCase()} ${toX402RoutePattern(fullPath)}`;

    if (routes[routeKey]) {
      throw new Error(`Duplicate payment config for ${routeKey}`);
    }

    routes[routeKey] = payment;
  }
}

export function createPaidRoutes(options: PaidRoutesOptions = {}): PaidRoutes {
  const basePath = normalizeBasePath(options.basePath);
  const routes: Record<string, RouteConfig> = {};
  const definitions: Array<RouteDefinition> = [];

  const register = (
    method: HttpMethod,
    path: string,
    handlers: RequestHandler[],
    payment?: RouteConfig
  ): PaidRoutes => {
    registerPaymentConfig(basePath, routes, method, path, payment);
    definitions.push({ method, path, handlers });
    return api;
  };

  const apply = (router: Router): Router => {
    for (const definition of definitions) {
      const registrar = router[definition.method] as (
        path: string,
        ...handlers: RequestHandler[]
      ) => Router;

      if (!registrar) {
        throw new Error(
          `Router missing method '${definition.method}' for ${definition.path}`
        );
      }

      registrar.call(router, definition.path, ...definition.handlers);
    }
    return router;
  };

  const createMethodRegistrar = (payment?: RouteConfig) => ({
    get: (path: string, ...handlers: RequestHandler[]) =>
      register("get", path, handlers, payment),
    post: (path: string, ...handlers: RequestHandler[]) =>
      register("post", path, handlers, payment),
    put: (path: string, ...handlers: RequestHandler[]) =>
      register("put", path, handlers, payment),
    patch: (path: string, ...handlers: RequestHandler[]) =>
      register("patch", path, handlers, payment),
    delete: (path: string, ...handlers: RequestHandler[]) =>
      register("delete", path, handlers, payment),
    options: (path: string, ...handlers: RequestHandler[]) =>
      register("options", path, handlers, payment),
    head: (path: string, ...handlers: RequestHandler[]) =>
      register("head", path, handlers, payment),
    all: (path: string, ...handlers: RequestHandler[]) =>
      register("all", path, handlers, payment),
  });

  const api: PaidRoutes = {
    routes,
    apply,
    ...createMethodRegistrar(),
    withPayment: (payment: RouteConfig) => createMethodRegistrar(payment),
  };

  return api;
}

export function createExpressPaidRoutes(
  app: Application | Router,
  options: ExpressPaidRoutesOptions
): ExpressPaidRoutes {
  const basePath = normalizeBasePath(options.basePath);
  const routes: Record<string, RouteConfig> = {};

  // Track if middleware has been applied
  let middlewareApplied = false;

  const applyMiddleware = () => {
    if (middlewareApplied) return;
    middlewareApplied = true;

    const middlewareConfig: ExpressPaymentMiddlewareConfig = {
      ...options.middleware,
      routes,
    };

    app.use(createExpressPaymentMiddleware(middlewareConfig));
  };

  const register = (
    method: HttpMethod,
    path: string,
    handler: RequestHandler,
    opts?: PaidRouteOptions
  ): ExpressPaidRoutes => {
    registerPaymentConfig(basePath, routes, method, path, opts?.payment);

    // Apply middleware before first route registration
    applyMiddleware();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registrar = (app as any)[method];
    if (!registrar) {
      throw new Error(`Express app missing method '${method}' for ${path}`);
    }

    registrar.call(app, path, handler);
    return api;
  };

  const api: ExpressPaidRoutes = {
    app,
    routes,
    get: (path, handler, opts) => register("get", path, handler, opts),
    post: (path, handler, opts) => register("post", path, handler, opts),
    put: (path, handler, opts) => register("put", path, handler, opts),
    patch: (path, handler, opts) => register("patch", path, handler, opts),
    delete: (path, handler, opts) => register("delete", path, handler, opts),
    options: (path, handler, opts) => register("options", path, handler, opts),
    head: (path, handler, opts) => register("head", path, handler, opts),
    all: (path, handler, opts) => register("all", path, handler, opts),
  };

  return api;
}
