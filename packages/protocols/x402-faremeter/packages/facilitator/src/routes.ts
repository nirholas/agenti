import { getLogger } from "@faremeter/logs";
import { Hono, type Context } from "hono";
import * as x from "@faremeter/types/x402";
import * as x2 from "@faremeter/types/x402v2";
import { isValidationError } from "@faremeter/types";
import type { FacilitatorHandler } from "@faremeter/types/facilitator";
import { caip2ToLegacyName, legacyNameToCAIP2 } from "@faremeter/info/evm";
import {
  caip2ToLegacyNetworkIds,
  legacyNetworkIdToCAIP2,
} from "@faremeter/info/solana";
import { allSettledWithTimeout } from "./promise";
import {
  adaptRequirementsV1ToV2,
  adaptPayloadV1ToV2,
  adaptVerifyResponseV2ToV1,
  adaptSettleResponseV2ToV1,
  adaptRequirementsV2ToV1,
  extractResourceInfoV1,
  adaptSupportedKindV2ToV1,
} from "./adapters";

const logger = await getLogger(["faremeter", "facilitator"]);

/**
 * Translate a CAIP-2 network identifier to a v1 legacy network name.
 * Falls through to the original identifier if no mapping exists.
 */
function translateNetwork(network: string): string {
  const evmLegacy = caip2ToLegacyName(network);
  if (evmLegacy) return evmLegacy;

  const solanaLegacy = caip2ToLegacyNetworkIds(network);
  const firstSolanaId = solanaLegacy?.[0];
  if (firstSolanaId) return firstSolanaId;

  return network;
}

/**
 * Normalize a v1 legacy network name to a CAIP-2 identifier.
 * Falls through to the original identifier if no mapping exists (it may
 * already be CAIP-2 or an unknown network).
 */
function normalizeNetwork(network: string): string {
  const evmCaip2 = legacyNameToCAIP2(network);
  if (evmCaip2) return evmCaip2;

  const solanaNetwork = legacyNetworkIdToCAIP2(network);
  if (solanaNetwork) return solanaNetwork.caip2;

  return network;
}

/**
 * Configuration arguments for creating facilitator routes.
 */
type CreateFacilitatorRoutesArgs = {
  /** Array of handlers that process payment operations. */
  handlers: FacilitatorHandler[];
  /** Optional timeout settings in milliseconds for handler operations. */
  timeout?: {
    /** Timeout for getRequirements calls. Defaults to 500ms. */
    getRequirements?: number;
    /** Timeout for getSupported calls. Defaults to 500ms. */
    getSupported?: number;
  };
};

type StatusCode = 400 | 500;

function summarizeRequirements({
  scheme,
  network,
  asset,
  payTo,
}: x2.x402PaymentRequirements) {
  return {
    scheme,
    network,
    asset,
    payTo,
  };
}

export function getClientIP(c: Context): string | undefined {
  const xff = c.req.header("X-Forwarded-For");
  if (xff) {
    const firstIP = xff.split(",")[0]?.trim();
    if (firstIP) return firstIP;
  }
  return c.req.header("X-Real-IP");
}

function processException<T>(step: string, e: unknown, cb: (msg: string) => T) {
  // XXX - We can do a better job of determining if it's a chain
  // error, or some other issue.
  const msg = e instanceof Error ? e.message : `unknown error handling ${step}`;

  logger.error(`Caught exception during ${step}`, {
    exception: e,
  });

  return cb(msg);
}

/**
 * Creates a Hono router with x402 facilitator endpoints.
 *
 * The router provides the following endpoints:
 * - POST /verify - Verify a payment without settling
 * - POST /settle - Verify and settle a payment
 * - POST /accepts - Get payment requirements for a resource
 * - GET /supported - List supported payment schemes and networks
 *
 * Both v1 and v2 protocol formats are supported on all endpoints.
 *
 * @param args - Configuration including payment handlers and timeouts
 * @returns A Hono router instance with facilitator endpoints
 */
export function createFacilitatorRoutes(args: CreateFacilitatorRoutesArgs) {
  const router = new Hono();

  function logRejected(
    results: PromiseSettledResult<unknown>[],
    label: string,
  ) {
    for (const r of results) {
      if (r.status === "rejected") {
        const message =
          r.reason instanceof Error ? r.reason.message : "unknown reason";
        logger.error(
          `failed to retrieve ${label} from facilitator handler: ${message}`,
          r.reason,
        );
      }
    }
  }

  function logError(msg: string | undefined, stepLabel: string) {
    if (msg !== undefined) {
      logger.error(msg);
    } else {
      logger.error(`unknown error during ${stepLabel}`);
    }
  }

  function sendVerifyErrorV1(
    c: Context,
    status: StatusCode,
    msg: string | undefined,
  ) {
    logError(msg, "verification");
    c.status(status);
    const response: x.x402VerifyResponse = { isValid: false, payer: "" };
    if (msg !== undefined) {
      response.invalidReason = msg;
    }
    return c.json(response);
  }

  function sendSettleErrorV1(
    c: Context,
    status: StatusCode,
    msg: string | undefined,
  ) {
    logError(msg, "settlement");
    c.status(status);
    const response: x.x402SettleResponse = {
      success: false,
      payer: "",
      transaction: "",
      network: "",
    };
    if (msg !== undefined) {
      response.errorReason = msg;
    }
    return c.json(response);
  }

  // Accepts errors are always v1 format. A v2 request that fails to parse
  // falls through to v1 parsing, so this path is only reached for v1 errors.
  function sendAcceptsError(
    c: Context,
    status: StatusCode,
    msg: string | undefined,
  ) {
    logError(msg, "accepts");
    c.status(status);
    return c.json({ x402Version: 1, accepts: [], error: msg ?? "" });
  }

  function sendVerifyErrorV2(
    c: Context,
    status: StatusCode,
    msg: string | undefined,
  ) {
    logError(msg, "verification");
    c.status(status);
    const response: x2.x402VerifyResponse = { isValid: false };
    if (msg !== undefined) {
      response.invalidReason = msg;
    }
    return c.json(response);
  }

  function sendSettleErrorV2(
    c: Context,
    status: StatusCode,
    msg: string | undefined,
  ) {
    logError(msg, "settlement");
    c.status(status);
    const response: x2.x402SettleResponse = {
      success: false,
      transaction: "",
      network: "",
    };
    if (msg !== undefined) {
      response.errorReason = msg;
    }
    return c.json(response);
  }

  /**
   * Iterate handlers, invoking each until one returns a non-null result.
   * Returns the handler result, or null if no handler matched.
   * Throws on handler exceptions (caller decides how to surface the error).
   */
  async function tryHandlers<TResult>(
    invoke: (handler: FacilitatorHandler) => Promise<TResult | null>,
  ): Promise<TResult | null> {
    for (const handler of args.handlers) {
      const result = await invoke(handler);
      if (result !== null) {
        return result;
      }
    }
    return null;
  }

  router.post("/verify", async (c) => {
    const body: unknown = await c.req.json();

    // Try v2 format first
    const v2Req = x2.x402VerifyRequest(body);

    if (!isValidationError(v2Req)) {
      const clientIP = getClientIP(c);
      logger.debug("starting verification attempt for v2 request", {
        ...v2Req,
        clientIP,
      });

      let result: x2.x402VerifyResponse | null;
      try {
        result = await tryHandlers((handler) =>
          handler.handleVerify
            ? handler.handleVerify(
                v2Req.paymentRequirements,
                v2Req.paymentPayload,
              )
            : Promise.resolve(null),
        );
      } catch (e) {
        return processException("verify", e, (msg) =>
          sendVerifyErrorV2(c, 500, msg),
        );
      }

      if (result === null) {
        logger.warning(
          "attempt to verify was made with no handler found, requirements summary was",
          summarizeRequirements(v2Req.paymentRequirements),
        );
        return sendVerifyErrorV2(c, 400, "no matching payment handler found");
      }

      logger.info(
        `${result.isValid ? "succeeded" : "failed"} verifying v2 request`,
        {
          ...result,
          requirements: summarizeRequirements(v2Req.paymentRequirements),
          clientIP,
        },
      );
      return c.json(result);
    }

    // Try v1 format
    const v1Req = x.x402VerifyRequest(body);

    if (isValidationError(v1Req)) {
      return sendVerifyErrorV1(
        c,
        400,
        `couldn't validate request: ${v1Req.summary}`,
      );
    }

    let paymentPayload = v1Req.paymentPayload;

    if (paymentPayload === undefined) {
      const decodedHeader = x.x402PaymentHeaderToPayload(v1Req.paymentHeader);

      if (isValidationError(decodedHeader)) {
        return sendVerifyErrorV1(
          c,
          400,
          `couldn't validate x402 payload: ${decodedHeader.summary}`,
        );
      }

      paymentPayload = decodedHeader;
    }

    const clientIP = getClientIP(c);
    logger.debug("starting verification attempt for v1 request", {
      ...v1Req,
      clientIP,
    });

    const v2Requirements = adaptRequirementsV1ToV2(
      v1Req.paymentRequirements,
      normalizeNetwork,
    );
    const v2Payload = adaptPayloadV1ToV2(
      paymentPayload,
      v1Req.paymentRequirements,
      normalizeNetwork,
    );

    let result: x2.x402VerifyResponse | null;
    try {
      result = await tryHandlers((handler) =>
        handler.handleVerify
          ? handler.handleVerify(v2Requirements, v2Payload)
          : Promise.resolve(null),
      );
    } catch (e) {
      return processException("verify", e, (msg) =>
        sendVerifyErrorV1(c, 500, msg),
      );
    }

    if (result === null) {
      logger.warning(
        "attempt to verify was made with no handler found, requirements summary was",
        summarizeRequirements(v2Requirements),
      );
      return sendVerifyErrorV1(c, 400, "no matching payment handler found");
    }

    logger.info(
      `${result.isValid ? "succeeded" : "failed"} verifying v1 request`,
      {
        ...result,
        requirements: summarizeRequirements(v2Requirements),
        clientIP,
      },
    );
    return c.json(adaptVerifyResponseV2ToV1(result));
  });

  router.post("/settle", async (c) => {
    const body: unknown = await c.req.json();

    // Try v2 format first
    const v2Req = x2.x402SettleRequest(body);

    if (!isValidationError(v2Req)) {
      const clientIP = getClientIP(c);
      logger.debug("starting settlement attempt for v2 request", {
        ...v2Req,
        clientIP,
      });

      let result: x2.x402SettleResponse | null;
      try {
        result = await tryHandlers((handler) =>
          handler.handleSettle(v2Req.paymentRequirements, v2Req.paymentPayload),
        );
      } catch (e) {
        return processException("settle", e, (msg) =>
          sendSettleErrorV2(c, 500, msg),
        );
      }

      if (result === null) {
        logger.warning(
          "attempt to settle was made with no handler found, requirements summary was",
          summarizeRequirements(v2Req.paymentRequirements),
        );
        return sendSettleErrorV2(c, 400, "no matching payment handler found");
      }

      logger.info(
        `${result.success ? "succeeded" : "failed"} settlement v2 request`,
        {
          requirements: summarizeRequirements(v2Req.paymentRequirements),
          transaction: result.transaction,
          clientIP,
        },
      );
      return c.json(result);
    }

    // Try v1 format
    const v1Req = x.x402SettleRequest(body);

    if (isValidationError(v1Req)) {
      return sendSettleErrorV1(
        c,
        400,
        `couldn't validate request: ${v1Req.summary}`,
      );
    }

    let paymentPayload = v1Req.paymentPayload;

    if (paymentPayload === undefined) {
      const decodedHeader = x.x402PaymentHeaderToPayload(v1Req.paymentHeader);

      if (isValidationError(decodedHeader)) {
        return sendSettleErrorV1(
          c,
          400,
          `couldn't validate x402 payload: ${decodedHeader.summary}`,
        );
      }

      paymentPayload = decodedHeader;
    }

    const clientIP = getClientIP(c);
    logger.debug("starting settlement attempt for v1 request", {
      ...v1Req,
      clientIP,
    });

    const v2Requirements = adaptRequirementsV1ToV2(
      v1Req.paymentRequirements,
      normalizeNetwork,
    );
    const v2Payload = adaptPayloadV1ToV2(
      paymentPayload,
      v1Req.paymentRequirements,
      normalizeNetwork,
    );

    let result: x2.x402SettleResponse | null;
    try {
      result = await tryHandlers((handler) =>
        handler.handleSettle(v2Requirements, v2Payload),
      );
    } catch (e) {
      return processException("settle", e, (msg) =>
        sendSettleErrorV1(c, 500, msg),
      );
    }

    if (result === null) {
      logger.warning(
        "attempt to settle was made with no handler found, requirements summary was",
        summarizeRequirements(v2Requirements),
      );
      return sendSettleErrorV1(c, 400, "no matching payment handler found");
    }

    logger.info(
      `${result.success ? "succeeded" : "failed"} settlement v1 request`,
      {
        requirements: summarizeRequirements(v2Requirements),
        transaction: result.transaction,
        clientIP,
      },
    );
    return c.json(adaptSettleResponseV2ToV1(result, translateNetwork));
  });

  router.post("/accepts", async (c) => {
    const body: unknown = await c.req.json();
    const clientIP = getClientIP(c);

    // The /accepts request body shares the same shape as the payment required
    // response (resource + accepts array), so we reuse the response validator.
    const v2Req = x2.x402PaymentRequiredResponse(body);

    if (!isValidationError(v2Req)) {
      // Native v2 request - call handlers directly with v2 requirements
      const results = await allSettledWithTimeout(
        args.handlers.flatMap((handler) =>
          handler.getRequirements({
            accepts: v2Req.accepts,
            resource: v2Req.resource,
          }),
        ),
        args.timeout?.getRequirements ?? 500,
      );

      const accepts = results
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value)
        .flat();

      logRejected(results, "requirements");

      logger.debug(`returning ${accepts.length} accepts for v2 request`, {
        accepts: accepts.map(summarizeRequirements),
        clientIP,
      });

      c.status(200);
      return c.json({
        x402Version: 2,
        resource: v2Req.resource,
        accepts,
      } satisfies x2.x402PaymentRequiredResponse);
    }

    // Try v1 format (lenient: Coinbase's implementation omits the error field)
    const v1Req = x.x402PaymentRequiredResponseLenient(body);

    if (isValidationError(v1Req)) {
      return sendAcceptsError(
        c,
        400,
        `couldn't parse required response: ${v1Req.summary}`,
      );
    }

    // Adapt v1 accepts to v2, normalizing legacy network names to CAIP-2
    const v2Accepts = v1Req.accepts.map((req) =>
      adaptRequirementsV1ToV2(req, normalizeNetwork),
    );
    const resourceInfo = v1Req.accepts[0]
      ? extractResourceInfoV1(v1Req.accepts[0])
      : { url: "" };

    const results = await allSettledWithTimeout(
      args.handlers.flatMap((handler) =>
        handler.getRequirements({
          accepts: v2Accepts,
          resource: resourceInfo,
        }),
      ),
      args.timeout?.getRequirements ?? 500,
    );

    const v2Results = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value)
      .flat();

    logRejected(results, "requirements");

    // Adapt v2 results back to v1 format
    const accepts = v2Results.map((r) =>
      adaptRequirementsV2ToV1(r, resourceInfo, translateNetwork),
    );

    logger.debug(`returning ${accepts.length} accepts for v1 request`, {
      accepts: accepts.map((a) => ({
        scheme: a.scheme,
        network: a.network,
        asset: a.asset,
        payTo: a.payTo,
      })),
      clientIP,
    });

    c.status(200);
    return c.json({
      x402Version: 1,
      accepts,
      error: "",
    });
  });

  router.get("/supported", async (c) => {
    const clientIP = getClientIP(c);
    const results = await allSettledWithTimeout(
      args.handlers.flatMap((handler) =>
        handler.getSupported ? handler.getSupported() : [],
      ),
      args.timeout?.getSupported ?? 500,
    );

    const v2Kinds = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value)
      .flat();

    logRejected(results, "supported");

    // Aggregate signers from handlers
    const signers: Record<string, string[]> = {};
    for (const handler of args.handlers) {
      if (handler.getSigners) {
        try {
          const handlerSigners = await handler.getSigners();
          for (const [network, addresses] of Object.entries(handlerSigners)) {
            if (signers[network]) {
              // Merge addresses, avoiding duplicates
              const existing = new Set(signers[network]);
              for (const addr of addresses) {
                if (!existing.has(addr)) {
                  signers[network].push(addr);
                }
              }
            } else {
              signers[network] = [...addresses];
            }
          }
        } catch (e) {
          logger.error("failed to retrieve signers from facilitator handler", {
            error: e,
          });
        }
      }
    }

    // Advertise both v1 and v2 support for all kinds
    const v1Kinds = v2Kinds.map((k) =>
      adaptSupportedKindV2ToV1(k, translateNetwork),
    );
    const allKinds = [...v1Kinds, ...v2Kinds];

    logger.debug(`returning ${allKinds.length} kinds supported`, {
      kinds: allKinds,
      clientIP,
    });

    c.status(200);
    return c.json({
      kinds: allKinds,
      extensions: [],
      signers,
    } satisfies x2.x402SupportedResponse);
  });

  return router;
}
