import {
  handleMiddlewareRequest,
  type CommonMiddlewareArgs,
  createPaymentRequiredResponseCache,
  resolveSupportedVersions,
} from "./common";
import type { MiddlewareHandler } from "hono";

/**
 * Configuration arguments for creating Hono x402 middleware.
 */
type CreateMiddlewareArgs = {
  /** If true, verifies payment before running the handler, then settles after. */
  verifyBeforeSettle?: boolean;
} & CommonMiddlewareArgs;

/**
 * Creates Hono middleware that gates routes behind x402 payment.
 *
 * The middleware intercepts requests, checks for payment headers, communicates
 * with the facilitator to validate and settle payments, and only allows the
 * request to proceed if payment is successful.
 *
 * @param args - Configuration including facilitator URL and accepted payment types
 * @returns A Hono middleware handler
 */
export async function createMiddleware(
  args: CreateMiddlewareArgs,
): Promise<MiddlewareHandler> {
  // Validate configuration at creation time
  const supportedVersions = resolveSupportedVersions(args.supportedVersions);

  const { getPaymentRequiredResponse, getPaymentRequiredResponseV2 } =
    createPaymentRequiredResponseCache(args.cacheConfig);

  return async (c, next) => {
    return await handleMiddlewareRequest({
      ...args,
      supportedVersions,
      resource: c.req.url,
      getHeader: (key) => c.req.header(key),
      setResponseHeader: (key, value) => c.header(key, value),
      getPaymentRequiredResponse,
      getPaymentRequiredResponseV2,
      sendJSONResponse: (status, body, headers) => {
        c.status(status);
        if (headers) {
          for (const [key, value] of Object.entries(headers)) {
            c.header(key, value);
          }
        }
        if (body) {
          return c.json(body);
        }
        return c.body(null);
      },
      body: async ({ verify, settle }) => {
        if (args.verifyBeforeSettle) {
          // If configured, try to verify the transaction before running
          // the next operation.
          const verifyResult = await verify();
          if (!verifyResult.success) {
            return verifyResult.errorResponse;
          }
        } else {
          // Otherwise just settle the payment beforehand, like we've
          // done historically.
          const settleResult = await settle();
          if (!settleResult.success) {
            return settleResult.errorResponse;
          }
        }

        await next();

        if (args.verifyBeforeSettle) {
          // Close out the verification, by actually settling the
          // payment.
          const settleResult = await settle();
          if (!settleResult.success) {
            // If the settlement fails, we need to explicitly
            // overwrite the downstream result.  See:
            //
            // https://hono.dev/docs/guides/middleware#modify-the-response-after-next
            //

            c.res = undefined;
            c.res = settleResult.errorResponse;
          }
        }
      },
    });
  };
}
