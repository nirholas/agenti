import {
  describe,
  it,
  beforeAll,
  afterAll,
  expect,
} from "bun:test";

import { Hono } from "hono";
import { paymentMiddleware } from "x402-hono";
import {
  wrapFetchWithPayment,
  decodeXPaymentResponse,
  createSigner,
} from "x402-fetch";

import { Facilitator } from "../src/facilitator"; // <- adjust path if needed
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

function normalizeServerUrl(server: any): string {
  // Bun.serve() returns e.g. "http://0.0.0.0:12345"
  // We want a usable loopback URL.
  const u = new URL(server.url);
  return `http://127.0.0.1:${u.port}`;
}

describe("x402 e2e on base-sepolia", () => {
  let facilitatorServer: any;
  let facilitatorUrl: string;

  let resourceServer: any;
  let resourceUrl: string;

  let buyerAccount: ReturnType<typeof privateKeyToAccount>;

  beforeAll(async () => {
    const sellerPk = process.env.SELLER_PRIVATE_KEY as `0x${string}`;
    const buyerPk = process.env.BUYER_PRIVATE_KEY as `0x${string}`;

    if (!sellerPk) {
      throw new Error("SELLER_PRIVATE_KEY missing in env");
    }
    if (!buyerPk) {
      throw new Error("BUYER_PRIVATE_KEY missing in env");
    }

    // 1. init facilitator core (our package)
    const facilitatorCore = new Facilitator({
      evmPrivateKey: sellerPk,
      networks: [baseSepolia],
      minConfirmations: 1,
    });

    // 2. start facilitator HTTP server
    facilitatorServer = Bun.serve({
      port: 0,
      fetch: async (req: Request) => {
        const { pathname } = new URL(req.url);

        if (req.method === "GET" && pathname === "/supported") {
          const data = facilitatorCore.listSupportedKinds();
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        if (req.method === "POST" && pathname === "/verify") {
          const body = await req.json();
          const { paymentPayload, paymentRequirements } = body;
          const data = await facilitatorCore.verifyPayment(
            paymentPayload,
            paymentRequirements
          );
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        if (req.method === "POST" && pathname === "/settle") {
          const body = await req.json();
          const { paymentPayload, paymentRequirements } = body;
          const data = await facilitatorCore.settlePayment(
            paymentPayload,
            paymentRequirements
          );
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        return new Response("not found", { status: 404 });
      },
    });

    facilitatorUrl = normalizeServerUrl(facilitatorServer);

    // 3. create paywalled API server with x402-hono
    const sellerAccount = privateKeyToAccount(sellerPk);

    const app = new Hono();

    app.use(
      paymentMiddleware(
        sellerAccount.address, // where $$ lands
        {
          "/protected-route": {
            price: "$0.01", // charge 1 cent USD in USDC
            network: "base-sepolia",
            config: {
              description: "test protected resource",
            },
          },
        },
        {
          // point middleware at OUR facilitator instance
          url: facilitatorUrl as `${string}://${string}`,
        }
      )
    );

    // the paid resource
    app.get("/protected-route", (c) => {
      return c.json({ secret: "shh-this-is-paid" });
    });

    resourceServer = Bun.serve({
      port: 0,
      fetch: app.fetch,
    });

    resourceUrl = normalizeServerUrl(resourceServer);

    // 4. init buyer wallet account (used by x402-fetch)
    // Note: We just use this for address info; the actual signer is created per-network
    buyerAccount = privateKeyToAccount(buyerPk);
  });

  afterAll(() => {
    resourceServer.stop();
    facilitatorServer.stop();
  });

  it("pays and gets the protected resource", async () => {
    // x402-fetch wraps fetch so that:
    // 1. it makes the request
    // 2. sees 402 + paymentRequirements if needed
    // 3. signs a payment payload with buyerAccount
    // 4. retries with X-PAYMENT header
    // 5. returns the final 200 + response body + X-PAYMENT-RESPONSE header
    //
    // this is the exact flow described in the Buyer quickstart. :contentReference[oaicite:7]{index=7}
    
    // Create a proper signer with network configuration
    const buyerPk = process.env.BUYER_PRIVATE_KEY as `0x${string}`;
    const buyerSigner = await createSigner("base-sepolia", buyerPk);
    
    const fetchWithPayment = wrapFetchWithPayment(fetch as any, buyerSigner);

    const res = await fetchWithPayment(
      `${resourceUrl}/protected-route`,
      { method: "GET" }
    );

    // should now be authorized and settled
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ secret: "shh-this-is-paid" });

    // middleware encodes payment settlement info (tx hash, payer, etc.)
    // into x-payment-response header so the buyer can confirm settlement. :contentReference[oaicite:8]{index=8}
    const rawPaymentResp = res.headers.get("x-payment-response");
    expect(rawPaymentResp).toBeTruthy();

    const decoded = decodeXPaymentResponse(rawPaymentResp!);

    expect(decoded.success).toBe(true);
    expect(decoded.network).toBe("base-sepolia");
    expect(decoded.payer.toLowerCase()).toBe(
      buyerAccount.address.toLowerCase()
    );
    expect(decoded.transaction).toMatch(/^0x[0-9a-fA-F]+$/);
  });
});
