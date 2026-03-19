import express from "express";
import cors from "cors";
import { paymentMiddleware } from "x402-express";
import { facilitator } from "@coinbase/x402";
import { exact } from "x402/schemes";
import * as dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3100;
const payTo = process.env.PAY_TO || "0x233521928665E16de96267D17313571687eC41b7";
const network = (process.env.NETWORK || "base-sepolia") as "base-sepolia" | "base" | "avalanche-fuji" | "avalanche" | "iotex" | "solana-devnet" | "solana" | "sei" | "sei-testnet" | "polygon" | "polygon-amoy";

app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000", "https://ping-crossmint-client.vercel.app"],
  credentials: true,
}));

// Debug logging middleware to trace x402 flow
app.use((req, res, next) => {
  const start = Date.now();
  const accept = req.header("Accept");
  const xpay = req.header("X-PAYMENT");
  console.log(`[REQ] ${req.method} ${req.path} accept=${accept} xpay=${xpay ? `len:${xpay.length}` : "none"}`);
  // Capture JSON response body to log payer on 402
  const originalJson = res.json.bind(res);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (res as any).json = (body: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (res as any).locals = (res as any).locals || {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (res as any).locals._jsonBody = body;
    return originalJson(body as never);
  };
  if (xpay) {
    try {
      const decoded = exact.evm.decodePayment(xpay);
      console.log({xpay, decoded: JSON.stringify(decoded, null, 2)})
      const auth = (decoded as any)?.payload?.authorization;
      console.log(`[X-PAYMENT] v${decoded.x402Version} scheme=${decoded.scheme} network=${decoded.network}`);
      console.log(`[X-PAYMENT] authorization.from: ${auth?.from}`);
      console.log(`[X-PAYMENT] authorization.to  : ${auth?.to}`);
      console.log(`[X-PAYMENT] authorization.value: ${auth?.value}`);
    } catch (e) {
      console.log("[X-PAYMENT] decode failed:", e);
    }
  }
  res.on("finish", () => {
    const dur = Date.now() - start;
    const respHeader = res.getHeader("X-PAYMENT-RESPONSE");
    console.log(
      `[RES] ${req.method} ${req.path} -> ${res.statusCode} ${res.statusMessage} dur=${dur}ms X-PAYMENT-RESPONSE=${respHeader ? "present" : "none"}`,
    );
    // If 402 JSON included a recovered payer, log it for clarity
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (res as any).locals?._jsonBody as { payer?: string; error?: unknown } | undefined;
    if (res.statusCode === 402 && body) {
      console.log(`[VERIFY] body: ${JSON.stringify(body)}`);
      if (body.payer) {
        console.log(`[VERIFY] recovered payer: ${body.payer}`);
      }
      if (body.error) {
        console.log(`[VERIFY] reason: ${typeof body.error === "string" ? body.error : JSON.stringify(body.error)}`);
      }
    }
  });
  next();
});

app.use(paymentMiddleware(payTo as any, {
  "GET /ping": { price: "$0.001", network }
}, facilitator));

app.get("/", (_req, res) => {
  res.json({ ok: true });
});

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    port,
    network,
    payTo: payTo.substring(0, 10) + "...",
    endpoints: {
      ping: "$0.001"
    }
  });
});

app.get("/ping", (_req, res) => {
  res.json({ message: "pong" });
});

app.listen(port, () => {
  console.log(`ping-crossmint server listening on http://localhost:${port}`);
});
