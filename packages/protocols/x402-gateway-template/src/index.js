// src/index.js

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { x402PaymentMiddleware } from './middleware/x402.js';
import { proxyToBackend } from './proxy.js';
import { ROUTE_CONFIG, SUPPORTED_NETWORKS } from './config/routes.js';
import { pingRedis } from './utils/redis.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Trust proxy headers (Cloudflare, Cloud Run, load balancers)
app.set('trust proxy', true);

// Middleware
app.use(cors());
app.use(express.json());

// Static assets (optional landing page)
app.use(express.static('public'));

// ─── Helpers ───────────────────────────────────────────────

// Express 5 returns wildcard params as arrays
function getSubpath(params) {
  return Array.isArray(params.path) ? params.path.join('/') : params.path;
}

// Extract payer address from x402 payment header
function extractPayerFromPaymentHeader(req) {
  const paymentHeader = req.headers['payment-signature'] || req.headers['x-payment'];
  if (!paymentHeader) return null;
  try {
    const paymentPayload = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());
    return paymentPayload.payload?.authorization?.from || null;
  } catch {
    return null;
  }
}

// ============================================================
// Landing page
// ============================================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ============================================================
// Health check (unprotected)
// ============================================================
app.get('/health', async (req, res) => {
  const redisHealthy = await pingRedis();

  // Categorize networks
  const networkKeys = Object.keys(SUPPORTED_NETWORKS);
  const evmNetworks = networkKeys.filter(k => SUPPORTED_NETWORKS[k].vm === 'evm');
  const svmNetworks = networkKeys.filter(k => SUPPORTED_NETWORKS[k].vm === 'svm');

  // Check backend status for each route
  const backends = {};
  for (const [key, route] of Object.entries(ROUTE_CONFIG)) {
    const configured = !!route.backendUrl;
    backends[key] = {
      configured,
      status: configured ? 'ready' : 'not configured',
    };
  }

  res.json({
    status: redisHealthy ? 'healthy' : 'degraded',
    service: 'x402-gateway',
    version: '1.0.0',
    backends,
    redis: {
      status: redisHealthy ? 'connected' : 'unreachable',
      features: ['nonce-tracking', 'idempotency-cache'],
    },
    payment: {
      settlement: 'local',
      networks: networkKeys.map(caip2 => {
        const net = SUPPORTED_NETWORKS[caip2];
        return {
          network: caip2,
          vm: net.vm,
          ...(net.chainId && { chainId: net.chainId }),
          token: net.token.address,
          settlement: net.facilitator ? 'facilitator' : 'local',
        };
      }),
      summary: {
        total: networkKeys.length,
        evm: evmNetworks.length,
        svm: svmNetworks.length,
      },
    },
    routes: Object.keys(ROUTE_CONFIG).map(key => ({
      path: ROUTE_CONFIG[key].path,
      price: ROUTE_CONFIG[key].price,
      backend: ROUTE_CONFIG[key].backendName,
      description: ROUTE_CONFIG[key].description,
    })),
  });
});

// ============================================================
// x402 Discovery Document (/.well-known/x402)
// ============================================================
app.get('/.well-known/x402', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const resources = Object.values(ROUTE_CONFIG).map(route => `${baseUrl}${route.path}`);

  // Build chain list for instructions
  const networkKeys = Object.keys(SUPPORTED_NETWORKS);
  const chainNames = networkKeys.map(caip2 => {
    const net = SUPPORTED_NETWORKS[caip2];
    // Simple name extraction from CAIP-2 or config
    if (net.vm === 'svm') return 'Solana';
    const chainMap = {
      8453: 'Base', 1: 'Ethereum', 42161: 'Arbitrum', 10: 'Optimism',
      137: 'Polygon', 43114: 'Avalanche', 130: 'Unichain', 59144: 'Linea',
    };
    return chainMap[net.chainId] || `Chain ${net.chainId}`;
  });

  // Build route documentation
  const routeDocs = Object.entries(ROUTE_CONFIG).map(([key, route]) => [
    `### ${route.backendName} — ${route.price}/request`,
    `\`POST /v1/${key}/*\``,
    route.description,
    '',
  ].join('\n')).join('\n');

  res.json({
    version: 1,
    resources,
    instructions: [
      '# x402 Payment Gateway',
      '',
      'Pay-per-request APIs with USDC micropayments — no API keys, no subscriptions.',
      '',
      '## Resources',
      '',
      routeDocs,
      '## Payment',
      '',
      `Pay on any of ${networkKeys.length} chains: ${chainNames.join(', ')}.`,
      'Idempotency supported via `payment-identifier` extension — safe retries without double-charging.',
    ].join('\n'),
  });
});

// ============================================================
// Accepted payment routes (agent-friendly discovery)
// ============================================================
app.get('/accepted', (req, res) => {
  const basePriceDecimals = 6;

  const routes = Object.entries(ROUTE_CONFIG).map(([key, route]) => {
    const basePriceAtomic = BigInt(route.priceAtomic);

    const networks = Object.entries(SUPPORTED_NETWORKS).map(([caip2, network]) => {
      const decimalDiff = network.token.decimals - basePriceDecimals;
      const amountRequired = decimalDiff > 0
        ? (basePriceAtomic * (10n ** BigInt(decimalDiff))).toString()
        : basePriceAtomic.toString();

      return {
        network: caip2,
        vm: network.vm,
        ...(network.chainId && { chainId: network.chainId }),
        asset: network.token.address,
        assetName: network.token.name || network.token.address,
        decimals: network.token.decimals,
        amountRequired,
        settlement: network.facilitator ? 'facilitator' : 'local',
      };
    });

    return {
      path: `/v1/${key}/*`,
      backend: route.backendName,
      price: route.price,
      payTo: route.payTo || null,
      payToSol: route.payToSol || null,
      description: route.description,
      mimeType: route.mimeType,
      networks,
      extensions: {
        'payment-identifier': {
          supported: true,
          required: false,
        },
        bazaar: {
          discoverable: true,
        },
      },
    };
  });

  res.json({
    x402Version: 2,
    service: 'x402-gateway',
    routes,
  });
});

// ============================================================
// REGISTER YOUR ROUTES BELOW
// ============================================================
//
// For each route in ROUTE_CONFIG, create:
//   1. A paid route with x402PaymentMiddleware
//   2. Optional free routes (health checks, job polling, etc.)
//
// The middleware handles:
//   - Returning 402 with payment requirements if no payment header
//   - Verifying the payment signature
//   - Settling the payment on-chain
//   - Calling next() so your handler runs
//
// Your handler then proxies the request to your backend.

// ── Example: "myapi" route (PAID) ────────────────────────
app.all('/v1/myapi/{*path}', x402PaymentMiddleware('myapi'), async (req, res) => {
  try {
    const subpath = getSubpath(req.params);
    const route = ROUTE_CONFIG.myapi;

    if (!route.backendUrl) {
      return res.status(503).json({
        error: 'Backend not configured',
        message: 'MY_BACKEND_URL environment variable is not set',
      });
    }

    // Optional: Map friendly paths to backend paths
    const PATH_ALIASES = {
      // 'friendly-name': 'actual-backend-endpoint',
    };
    const resolvedSubpath = PATH_ALIASES[subpath] || subpath;

    await proxyToBackend({
      req,
      res,
      targetBase: route.backendUrl,
      targetPath: '/api/' + resolvedSubpath,
      apiKey: process.env[route.backendApiKeyEnv],
      apiKeyHeader: route.backendApiKeyHeader,
    });
  } catch (err) {
    console.error('[myapi] Proxy error:', err.message);
    res.status(502).json({ error: 'Backend unavailable' });
  }
});

// ── Example: Free health check for "myapi" ───────────────
// app.get('/v1/myapi/health', async (req, res) => {
//   try {
//     const route = ROUTE_CONFIG.myapi;
//     if (!route.backendUrl) {
//       return res.status(503).json({ error: 'Backend not configured' });
//     }
//     await proxyToBackend({
//       req, res,
//       targetBase: route.backendUrl,
//       targetPath: '/api/health',
//       apiKey: process.env[route.backendApiKeyEnv],
//       apiKeyHeader: route.backendApiKeyHeader,
//     });
//   } catch (err) {
//     res.status(502).json({ error: 'Backend unavailable' });
//   }
// });

// ============================================================
// Start server
// ============================================================
app.listen(PORT, async () => {
  console.log(`[x402-gateway] Listening on port ${PORT}`);
  console.log(`[x402-gateway] Settlement: local (viem + @x402/svm)`);

  // Check Redis connectivity
  const redisOk = await pingRedis();
  console.log(`[x402-gateway] Redis: ${redisOk ? '✓ connected' : '✗ unreachable'}`);

  // Log backend status
  console.log(`[x402-gateway] Backends:`);
  for (const [key, route] of Object.entries(ROUTE_CONFIG)) {
    const configured = !!route.backendUrl;
    console.log(`  ${key}: ${configured ? '✓ configured' : '✗ not set'}`);
  }

  // Log active networks
  const networkKeys = Object.keys(SUPPORTED_NETWORKS);
  const evmCount = networkKeys.filter(k => SUPPORTED_NETWORKS[k].vm === 'evm').length;
  const svmCount = networkKeys.filter(k => SUPPORTED_NETWORKS[k].vm === 'svm').length;
  console.log(`[x402-gateway] Active networks (${networkKeys.length}): ${evmCount} EVM, ${svmCount} SVM`);

  networkKeys.forEach(caip2 => {
    const net = SUPPORTED_NETWORKS[caip2];
    let mode;
    if (net.vm === 'svm') {
      mode = 'local settlement (@x402/svm)';
    } else if (net.facilitator) {
      mode = `facilitator (${net.facilitator.url})`;
    } else {
      mode = 'local settlement (viem)';
    }
    const chainLabel = net.chainId ? `chain ${net.chainId}` : net.vm.toUpperCase();
    console.log(`  ${caip2} (${chainLabel}) — ${mode}`);
  });

  // Log routes
  console.log(`[x402-gateway] Routes:`);
  Object.entries(ROUTE_CONFIG).forEach(([key, route]) => {
    console.log(`  /v1/${key}/* -> ${route.backendName} (${route.price})`);
  });
});
