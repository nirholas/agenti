/**
 * @fileoverview X402 Example Server
 * @description Express server demonstrating x402 payment paywalls
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 * 
 * This example shows how to create a server that:
 * - Protects endpoints with x402 payment requirements
 * - Uses different pricing strategies
 * - Tracks payments and analytics
 * - Provides a dashboard to view earnings
 * 
 * @example
 * ```bash
 * # Set environment variables
 * export X402_SERVER_WALLET=0x...
 * export X402_DEFAULT_CHAIN=arbitrum
 * 
 * # Run the server
 * npx ts-node examples/server/index.ts
 * ```
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { 
  x402Paywall, 
  x402DynamicPaywall,
  x402ExtractPayment,
  x402TrackPayment,
} from '../../src/x402/server/middleware.js';
import { 
  dynamicPrice, 
  fixedPrice, 
  resourceBasedPrice,
  tieredPrice,
} from '../../src/x402/server/pricing.js';
import { X402Analytics, createFileAnalytics } from '../../src/x402/server/analytics.js';
import { loadX402ServerConfig } from '../../src/x402/server/config.js';
import type { X402Chain, X402Token } from '../../src/x402/sdk/types.js';

// ============================================================================
// Configuration
// ============================================================================

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// Load x402 config
const config = loadX402ServerConfig();

// Initialize analytics
const analytics = createFileAnalytics('./data/x402-example-payments.json');

// Joke database
const jokes = [
  "Why do programmers prefer dark mode? Because light attracts bugs!",
  "Why did the developer go broke? Because he used up all his cache!",
  "How many programmers does it take to change a light bulb? None, that's a hardware problem.",
  "Why do Java developers wear glasses? Because they can't C#!",
  "What's a programmer's favorite hangout place? Foo Bar!",
  "Why was the JavaScript developer sad? Because he didn't Node how to Express himself!",
  "A SQL query walks into a bar, walks up to two tables and asks... 'Can I join you?'",
  "Why do programmers hate nature? It has too many bugs and no debugging tool!",
  "What do you call 8 hobbits? A hobbyte!",
  "Why did the functions stop calling each other? Because they had constant arguments!",
];

// ============================================================================
// Create Express App
// ============================================================================

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Extract payment info from all requests
app.use(x402ExtractPayment());

// Track successful payments
app.use(x402TrackPayment(async (payment) => {
  await analytics.recordPayment({
    txHash: payment.proof as `0x${string}`,
    chain: payment.chain as X402Chain,
    amount: payment.amount,
    token: payment.token as X402Token,
    payer: '0x0000000000000000000000000000000000000000', // Would extract from payment
    resource: payment.resource,
  });
  console.log(`💰 Payment received: ${payment.amount} ${payment.token} for ${payment.resource}`);
}));

// ============================================================================
// Public Endpoints
// ============================================================================

/**
 * Health check
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'healthy',
    version: '1.0.0',
    x402: {
      configured: !!config.walletAddress,
      chain: config.defaultChain,
      token: config.defaultToken,
    }
  });
});

/**
 * API Info
 */
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    name: 'X402 Example API',
    description: 'Demonstration of x402 payment paywalls',
    endpoints: {
      '/api/joke': {
        price: '$0.001',
        description: 'Get a random programming joke',
      },
      '/api/summary': {
        price: '$0.01',
        description: 'Summarize text (demo)',
      },
      '/api/image': {
        price: '$0.05',
        description: 'Generate an image (demo)',
      },
      '/api/premium/data': {
        price: '$0.10',
        description: 'Access premium data',
      },
    },
    dashboard: '/dashboard',
  });
});

// ============================================================================
// Paid Endpoints
// ============================================================================

/**
 * /api/joke - $0.001 per joke
 * Simple fixed price endpoint
 */
app.get('/api/joke', 
  x402Paywall({
    price: '0.001',
    token: 'USDs',
    network: 'arbitrum',
    description: 'Get a random programming joke',
  }),
  (_req: Request, res: Response) => {
    const joke = jokes[Math.floor(Math.random() * jokes.length)];
    res.json({
      joke,
      meta: {
        price: '0.001 USDs',
        category: 'programming',
      }
    });
  }
);

/**
 * /api/summary - $0.01 per summary
 * Demonstrates text processing endpoint
 */
app.post('/api/summary',
  x402Paywall({
    price: '0.01',
    token: 'USDs',
    network: 'arbitrum',
    description: 'Summarize provided text',
  }),
  (req: Request, res: Response) => {
    const text = req.body.text || '';
    
    // Simple "summary" - just take first 100 chars and add ellipsis
    const summary = text.length > 100 
      ? text.slice(0, 100) + '...' 
      : text;

    res.json({
      original_length: text.length,
      summary,
      summary_length: summary.length,
      compression_ratio: text.length > 0 ? (summary.length / text.length).toFixed(2) : 1,
      meta: {
        price: '0.01 USDs',
        note: 'This is a demo endpoint - real summarization would use AI',
      }
    });
  }
);

/**
 * /api/image - $0.05 per image
 * Demonstrates image generation endpoint
 */
app.post('/api/image',
  x402Paywall({
    price: '0.05',
    token: 'USDs',
    network: 'arbitrum',
    description: 'Generate an image from prompt',
  }),
  (req: Request, res: Response) => {
    const prompt = req.body.prompt || 'A beautiful sunset';
    
    // Return a placeholder image URL (demo only)
    res.json({
      prompt,
      image_url: `https://picsum.photos/seed/${encodeURIComponent(prompt)}/800/600`,
      width: 800,
      height: 600,
      meta: {
        price: '0.05 USDs',
        note: 'This is a demo endpoint - returns random image from picsum.photos',
      }
    });
  }
);

/**
 * /api/premium/* - $0.10 for premium content
 * Using resource-based pricing
 */
const premiumPricing = resourceBasedPrice({
  defaultPrice: '0.10',
  resources: [
    { pattern: '/api/premium/data', price: '0.10', description: 'Premium data access' },
    { pattern: '/api/premium/report', price: '0.25', description: 'Detailed report' },
    { pattern: '/api/premium/export', price: '0.50', description: 'Export all data' },
  ],
  token: 'USDs',
  network: 'arbitrum',
});

app.get('/api/premium/data',
  x402DynamicPaywall(premiumPricing, {
    token: 'USDs',
    network: 'arbitrum',
    description: 'Access premium data',
  }),
  (_req: Request, res: Response) => {
    res.json({
      data: {
        users: 1250,
        revenue: '$45,000',
        growth: '+15%',
        topProducts: ['Widget A', 'Gadget B', 'Service C'],
      },
      meta: {
        price: '0.10 USDs',
        access_level: 'premium',
      }
    });
  }
);

app.get('/api/premium/report',
  x402DynamicPaywall(premiumPricing, {
    token: 'USDs',
    network: 'arbitrum',
    description: 'Get detailed report',
  }),
  (_req: Request, res: Response) => {
    res.json({
      report: {
        period: 'Q4 2025',
        summary: 'Strong growth in all segments',
        metrics: {
          revenue: { value: '$45,000', change: '+12%' },
          users: { value: 1250, change: '+8%' },
          retention: { value: '94%', change: '+2%' },
        },
        recommendations: [
          'Invest in mobile experience',
          'Expand to new markets',
          'Improve onboarding flow',
        ],
      },
      meta: {
        price: '0.25 USDs',
        access_level: 'premium_plus',
      }
    });
  }
);

/**
 * /api/ai/generate - Dynamic pricing based on tokens
 */
const aiPricing = dynamicPrice({
  base: '0.001',
  perToken: '0.00001',  // $0.00001 per token
  minPrice: '0.001',
  maxPrice: '1.00',
  token: 'USDs',
  network: 'arbitrum',
});

app.post('/api/ai/generate',
  x402DynamicPaywall(aiPricing, {
    token: 'USDs',
    network: 'arbitrum',
    description: 'AI text generation',
  }),
  (req: Request, res: Response) => {
    const prompt = req.body.prompt || 'Hello';
    const maxTokens = req.body.max_tokens || 100;
    
    // Simulate AI response
    const response = `This is a simulated AI response to: "${prompt}". In a real implementation, this would call an LLM like GPT-4 or Claude.`;
    const tokensUsed = Math.min(response.split(' ').length * 2, maxTokens);

    res.json({
      prompt,
      response,
      usage: {
        prompt_tokens: prompt.split(' ').length * 2,
        completion_tokens: tokensUsed,
        total_tokens: prompt.split(' ').length * 2 + tokensUsed,
      },
      meta: {
        price_per_token: '0.00001 USDs',
        note: 'This is a demo - real endpoint would use actual LLM',
      }
    });
  }
);

// ============================================================================
// Dashboard
// ============================================================================

/**
 * Dashboard - View earnings and statistics
 */
app.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const stats = await analytics.getStats();
    const revenueByEndpoint = await analytics.getRevenueByEndpoint();
    const topPayers = await analytics.getTopPayers({ limit: 5 });
    const recentPayments = await analytics.getRecentPayments(10);
    const dailyRevenue = await analytics.getRevenueOverTime({ groupBy: 'day', limit: 30 });

    // Generate HTML dashboard
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>X402 Payment Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body class="bg-gray-900 text-white min-h-screen">
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-8">💰 X402 Payment Dashboard</h1>
    
    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div class="bg-gray-800 rounded-lg p-6">
        <h3 class="text-gray-400 text-sm">Total Revenue</h3>
        <p class="text-2xl font-bold text-green-400">${stats.totalRevenue} USDs</p>
      </div>
      <div class="bg-gray-800 rounded-lg p-6">
        <h3 class="text-gray-400 text-sm">Total Payments</h3>
        <p class="text-2xl font-bold">${stats.totalPayments}</p>
      </div>
      <div class="bg-gray-800 rounded-lg p-6">
        <h3 class="text-gray-400 text-sm">Unique Payers</h3>
        <p class="text-2xl font-bold">${stats.uniquePayers}</p>
      </div>
      <div class="bg-gray-800 rounded-lg p-6">
        <h3 class="text-gray-400 text-sm">Avg Payment</h3>
        <p class="text-2xl font-bold">${stats.averagePayment} USDs</p>
      </div>
    </div>

    <!-- Revenue Chart -->
    <div class="bg-gray-800 rounded-lg p-6 mb-8">
      <h2 class="text-xl font-bold mb-4">Revenue Over Time</h2>
      <canvas id="revenueChart" height="100"></canvas>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <!-- Revenue by Endpoint -->
      <div class="bg-gray-800 rounded-lg p-6">
        <h2 class="text-xl font-bold mb-4">Revenue by Endpoint</h2>
        <table class="w-full">
          <thead>
            <tr class="text-gray-400 text-left">
              <th class="pb-2">Endpoint</th>
              <th class="pb-2">Revenue</th>
              <th class="pb-2">Count</th>
            </tr>
          </thead>
          <tbody>
            ${revenueByEndpoint.map(ep => `
              <tr class="border-t border-gray-700">
                <td class="py-2 font-mono text-sm">${ep.resource}</td>
                <td class="py-2 text-green-400">${ep.total} USDs</td>
                <td class="py-2">${ep.count}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Top Payers -->
      <div class="bg-gray-800 rounded-lg p-6">
        <h2 class="text-xl font-bold mb-4">Top Payers</h2>
        <table class="w-full">
          <thead>
            <tr class="text-gray-400 text-left">
              <th class="pb-2">Address</th>
              <th class="pb-2">Total</th>
              <th class="pb-2">Payments</th>
            </tr>
          </thead>
          <tbody>
            ${topPayers.map(payer => `
              <tr class="border-t border-gray-700">
                <td class="py-2 font-mono text-sm">${payer.address.slice(0, 6)}...${payer.address.slice(-4)}</td>
                <td class="py-2 text-green-400">${payer.total} USDs</td>
                <td class="py-2">${payer.count}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Recent Payments -->
    <div class="bg-gray-800 rounded-lg p-6 mt-8">
      <h2 class="text-xl font-bold mb-4">Recent Payments</h2>
      <table class="w-full">
        <thead>
          <tr class="text-gray-400 text-left">
            <th class="pb-2">Time</th>
            <th class="pb-2">Amount</th>
            <th class="pb-2">Resource</th>
            <th class="pb-2">Tx Hash</th>
          </tr>
        </thead>
        <tbody>
          ${recentPayments.map(p => `
            <tr class="border-t border-gray-700">
              <td class="py-2 text-sm">${new Date(p.timestamp).toLocaleString()}</td>
              <td class="py-2 text-green-400">${p.amount} ${p.token}</td>
              <td class="py-2 font-mono text-sm">${p.resource}</td>
              <td class="py-2 font-mono text-xs">${p.txHash.slice(0, 10)}...</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- API Pricing -->
    <div class="bg-gray-800 rounded-lg p-6 mt-8">
      <h2 class="text-xl font-bold mb-4">API Pricing</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-gray-700 rounded p-4">
          <h3 class="font-bold">/api/joke</h3>
          <p class="text-green-400 text-lg">$0.001</p>
          <p class="text-gray-400 text-sm">Get a programming joke</p>
        </div>
        <div class="bg-gray-700 rounded p-4">
          <h3 class="font-bold">/api/summary</h3>
          <p class="text-green-400 text-lg">$0.01</p>
          <p class="text-gray-400 text-sm">Summarize text</p>
        </div>
        <div class="bg-gray-700 rounded p-4">
          <h3 class="font-bold">/api/image</h3>
          <p class="text-green-400 text-lg">$0.05</p>
          <p class="text-gray-400 text-sm">Generate image</p>
        </div>
      </div>
    </div>
  </div>

  <script>
    // Revenue chart
    const ctx = document.getElementById('revenueChart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(dailyRevenue.map(d => d.period))},
        datasets: [{
          label: 'Revenue (USDs)',
          data: ${JSON.stringify(dailyRevenue.map(d => parseFloat(d.total)))},
          borderColor: '#4ade80',
          backgroundColor: 'rgba(74, 222, 128, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: '#374151'
            }
          },
          x: {
            grid: {
              color: '#374151'
            }
          }
        }
      }
    });
  </script>
</body>
</html>
    `;

    res.type('html').send(html);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

/**
 * Dashboard API - JSON format
 */
app.get('/dashboard/api', async (_req: Request, res: Response) => {
  try {
    const stats = await analytics.getStats();
    const revenueByEndpoint = await analytics.getRevenueByEndpoint();
    const topPayers = await analytics.getTopPayers({ limit: 10 });
    const dailyRevenue = await analytics.getRevenueOverTime({ groupBy: 'day', limit: 30 });

    res.json({
      stats,
      revenueByEndpoint,
      topPayers,
      dailyRevenue,
      config: {
        wallet: config.walletAddress ? `${config.walletAddress.slice(0, 6)}...${config.walletAddress.slice(-4)}` : 'not set',
        chain: config.defaultChain,
        token: config.defaultToken,
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

// ============================================================================
// Error Handling
// ============================================================================

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(Number(PORT), HOST, () => {
  console.log(`
🚀 X402 Example Server Running!
================================
URL: http://${HOST}:${PORT}

📍 Endpoints:
  GET  /api          - API info
  GET  /api/joke     - $0.001 per joke
  POST /api/summary  - $0.01 per summary
  POST /api/image    - $0.05 per image
  GET  /api/premium/data   - $0.10
  GET  /api/premium/report - $0.25
  POST /api/ai/generate    - Dynamic pricing

📊 Dashboard: http://${HOST}:${PORT}/dashboard

💼 Config:
  Wallet: ${config.walletAddress || 'NOT SET - payments will fail!'}
  Chain:  ${config.defaultChain}
  Token:  ${config.defaultToken}

${!config.walletAddress ? '⚠️  Set X402_SERVER_WALLET to enable payments!' : ''}
  `);
});

export default app;
