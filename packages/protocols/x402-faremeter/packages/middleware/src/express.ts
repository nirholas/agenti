import {
  handleMiddlewareRequest,
  type CommonMiddlewareArgs,
  createPaymentRequiredResponseCache,
  resolveSupportedVersions,
} from "./common";
import type { NextFunction, Request, Response } from "express";

type createMiddlewareArgs = CommonMiddlewareArgs;

/**
 * Creates Express middleware that gates routes behind x402 payment.
 *
 * The middleware intercepts requests, checks for payment headers, communicates
 * with the facilitator to validate and settle payments, and only allows the
 * request to proceed if payment is successful.
 *
 * @param args - Configuration including facilitator URL and accepted payment types
 * @returns An Express middleware function
 */
export async function createMiddleware(args: createMiddlewareArgs) {
  // Validate configuration at creation time
  const supportedVersions = resolveSupportedVersions(args.supportedVersions);

  const { getPaymentRequiredResponse, getPaymentRequiredResponseV2 } =
    createPaymentRequiredResponseCache(args.cacheConfig);

  return async (req: Request, res: Response, next: NextFunction) => {
    return await handleMiddlewareRequest({
      ...args,
      supportedVersions,
      resource: `${req.protocol}://${req.headers.host}${req.path}`,
      getPaymentRequiredResponse,
      getPaymentRequiredResponseV2,
      getHeader: (key) => req.header(key),
      setResponseHeader: (key, value) => res.setHeader(key, value),
      sendJSONResponse: (status, body, headers) => {
        res.status(status);
        if (headers) {
          for (const [key, value] of Object.entries(headers)) {
            res.setHeader(key, value);
          }
        }
        if (body) {
          return res.json(body);
        }
        return res.end();
      },
      body: async ({ settle }) => {
        const settleResult = await settle();
        if (!settleResult.success) {
          return settleResult.errorResponse;
        }

        next();
      },
    });
  };
}
