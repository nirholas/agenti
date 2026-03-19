import express from "express";
import cors from "cors";
import { paymentMiddleware } from "x402-express";
import { exact } from "x402/schemes";
import * as dotenv from "dotenv";
import { TwitterApi } from "twitter-api-v2";

dotenv.config();

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3200;
const payTo = process.env.MERCHANT_ADDRESS || "0x2bA11889a65DEC5467530A8C204d45EE6F8497e7";
const network = (process.env.X402_NETWORK || "base-sepolia") as any;

// Validate required env
if (!/^0x[a-fA-F0-9]{40}$/.test(payTo)) {
  console.error("❌ MERCHANT_ADDRESS is missing or invalid. Set MERCHANT_ADDRESS to a valid EVM address.");
  process.exit(1);
}

const allowedOrigins = process.env.CORS_ORIGIN?.split(",") || [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "http://localhost:5174",
  "https://sendvia-demo.vercel.app"
];
const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  exposedHeaders: ["X-PAYMENT-RESPONSE"],
};
app.use(cors(corsOptions));
app.options("/tweet", cors(corsOptions));
app.options("/wallet/init", cors(corsOptions));
app.options("/health", cors(corsOptions));
app.use(express.json({ limit: "1mb" }));

// Debug logging middleware to trace x402 flow
app.use((req, res, next) => {
  const start = Date.now();
  const accept = req.header("Accept");
  const xpay = req.header("X-PAYMENT");
  console.log(`[REQ] ${req.method} ${req.path} accept=${accept} xpay=${xpay ? `len:${xpay.length}` : "none"}`);
  res.on("finish", () => {
    const dur = Date.now() - start;
    const respHeader = res.getHeader("X-PAYMENT-RESPONSE");
    console.log(`[RES] ${req.method} ${req.path} -> ${res.statusCode} ${res.statusMessage} dur=${dur}ms X-PAYMENT-RESPONSE=${respHeader ? "present" : "none"}`);
  });
  next();
});

// Health
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    network,
    payTo: payTo.substring(0, 10) + "...",
    endpoints: { tweet: `$${process.env.PRICE_USDC || "1"}` },
  });
});

// x402 payment middleware for POST /tweet
app.use(paymentMiddleware(payTo as any, {
  "POST /tweet": { price: `$${process.env.PRICE_USDC || "1"}`, network }
}, {
  url: "https://x402.org/facilitator",
  createAuthHeaders: undefined
}));

function createTwitterClient() {
  const {
    TWITTER_CONSUMER_KEY,
    TWITTER_CONSUMER_SECRET,
    TWITTER_ACCESS_TOKEN,
    TWITTER_ACCESS_TOKEN_SECRET
  } = process.env;

  if (!TWITTER_CONSUMER_KEY || !TWITTER_CONSUMER_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_TOKEN_SECRET) {
    return null;
  }

  return new TwitterApi({
    appKey: TWITTER_CONSUMER_KEY,
    appSecret: TWITTER_CONSUMER_SECRET,
    accessToken: TWITTER_ACCESS_TOKEN,
    accessSecret: TWITTER_ACCESS_TOKEN_SECRET,
  });
}

app.post("/tweet", async (req, res) => {
  try {
    const { text, imageUrl } = req.body ?? {};
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Tweet text is required" });
    }

    const twitter = createTwitterClient();
    if (!twitter) {
      return res.status(500).json({ error: "Twitter API not configured" });
    }

    const options: any = {};
    if (imageUrl) {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return res.status(400).json({ error: "Failed to download image" });
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const mediaId = await twitter.v1.uploadMedia(buffer, { mimeType: "image/jpeg" });
      options.media = { media_ids: [mediaId] };
    }

    const result = await twitter.v2.tweet(text, options);

    return res.json({
      success: true,
      message: `Tweet sent successfully! Tweet ID: ${result.data.id}`,
      tweetId: result.data.id,
      tweetUrl: `https://twitter.com/user/status/${result.data.id}`,
      data: result.data
    });
  } catch (e: any) {
    console.error("/tweet error", e);
    return res.status(500).json({ error: e?.message || "Internal Server Error" });
  }
});

// Optional: server-side wallet init for API-key signer (for parity)
import { createCrossmint, CrossmintWallets } from "@crossmint/wallets-sdk";
app.post("/wallet/init", async (req, res) => {
  try {
    const { email } = req.body ?? {};
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }
    const apiKey = process.env.CROSSMINT_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Server configuration error: Crossmint API key not set" });
    }
    const crossmint = createCrossmint({ apiKey });
    const wallets = CrossmintWallets.from(crossmint);
    const wallet = await wallets.createWallet({
      chain: (process.env.X402_NETWORK || "base-sepolia") as any,
      signer: { type: "api-key" as const },
      owner: `email:${email}`
    });
    res.json({ address: wallet.address, email, network });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Failed to create account" });
  }
});

app.listen(port, () => {
  console.log(`sendvia server listening on http://localhost:${port}`);
});


