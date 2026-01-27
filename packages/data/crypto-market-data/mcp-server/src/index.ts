#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const COINGECKO_API = "https://api.coingecko.com/api/v3";
const DEFILLAMA_API = "https://api.llama.fi";

// Helper to fetch JSON
async function fetchJSON(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}

// CoinGecko API functions
async function getPrice(ids: string, currencies = "usd") {
  return fetchJSON(`${COINGECKO_API}/simple/price?ids=${ids}&vs_currencies=${currencies}&include_24hr_change=true&include_market_cap=true`);
}

async function getTopCoins(limit = 20) {
  return fetchJSON(`${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&sparkline=false`);
}

async function getCoinData(id: string) {
  return fetchJSON(`${COINGECKO_API}/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false`);
}

async function getOHLCV(id: string, days = 7) {
  return fetchJSON(`${COINGECKO_API}/coins/${id}/ohlc?vs_currency=usd&days=${days}`);
}

async function getTrending() {
  return fetchJSON(`${COINGECKO_API}/search/trending`);
}

async function searchCoins(query: string) {
  return fetchJSON(`${COINGECKO_API}/search?query=${encodeURIComponent(query)}`);
}

// DeFiLlama API functions
async function getProtocols() {
  return fetchJSON(`${DEFILLAMA_API}/protocols`);
}

async function getProtocolTVL(protocol: string) {
  return fetchJSON(`${DEFILLAMA_API}/protocol/${protocol}`);
}

async function getChainsTVL() {
  return fetchJSON(`${DEFILLAMA_API}/v2/chains`);
}

async function getYields() {
  return fetchJSON(`${DEFILLAMA_API}/pools`);
}

async function getStablecoins() {
  return fetchJSON(`https://stablecoins.llama.fi/stablecoins?includePrices=true`);
}

// Create MCP server
const server = new Server(
  { name: "crypto-market-data-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_crypto_price",
      description: "Get current price for one or more cryptocurrencies (comma-separated IDs like 'bitcoin,ethereum')",
      inputSchema: {
        type: "object",
        properties: {
          ids: { type: "string", description: "Coin IDs (e.g., 'bitcoin', 'ethereum,solana')" },
          currencies: { type: "string", description: "Target currencies (default: 'usd')" }
        },
        required: ["ids"]
      }
    },
    {
      name: "get_top_coins",
      description: "Get top cryptocurrencies by market cap",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of coins (default: 20, max: 100)" }
        }
      }
    },
    {
      name: "get_coin_details",
      description: "Get detailed information about a specific cryptocurrency",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Coin ID (e.g., 'bitcoin')" }
        },
        required: ["id"]
      }
    },
    {
      name: "get_ohlcv",
      description: "Get OHLCV (Open, High, Low, Close, Volume) candlestick data",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Coin ID (e.g., 'bitcoin')" },
          days: { type: "number", description: "Number of days (1, 7, 14, 30, 90, 180, 365)" }
        },
        required: ["id"]
      }
    },
    {
      name: "get_trending",
      description: "Get trending cryptocurrencies on CoinGecko",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "search_coins",
      description: "Search for cryptocurrencies by name or symbol",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" }
        },
        required: ["query"]
      }
    },
    {
      name: "get_defi_protocols",
      description: "Get list of DeFi protocols with TVL from DeFiLlama",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "get_protocol_tvl",
      description: "Get TVL history and details for a specific DeFi protocol",
      inputSchema: {
        type: "object",
        properties: {
          protocol: { type: "string", description: "Protocol slug (e.g., 'aave', 'uniswap')" }
        },
        required: ["protocol"]
      }
    },
    {
      name: "get_chains_tvl",
      description: "Get TVL for all blockchain networks",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "get_defi_yields",
      description: "Get DeFi yield farming opportunities from DeFiLlama",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "get_stablecoins",
      description: "Get stablecoin market data and supplies",
      inputSchema: { type: "object", properties: {} }
    }
  ]
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: any;

    switch (name) {
      case "get_crypto_price":
        result = await getPrice(args?.ids as string, args?.currencies as string || "usd");
        break;
      case "get_top_coins":
        result = await getTopCoins(Math.min(args?.limit as number || 20, 100));
        break;
      case "get_coin_details":
        result = await getCoinData(args?.id as string);
        break;
      case "get_ohlcv":
        result = await getOHLCV(args?.id as string, args?.days as number || 7);
        break;
      case "get_trending":
        result = await getTrending();
        break;
      case "search_coins":
        result = await searchCoins(args?.query as string);
        break;
      case "get_defi_protocols":
        const protocols = await getProtocols();
        result = protocols.slice(0, 50); // Top 50 by TVL
        break;
      case "get_protocol_tvl":
        result = await getProtocolTVL(args?.protocol as string);
        break;
      case "get_chains_tvl":
        result = await getChainsTVL();
        break;
      case "get_defi_yields":
        const yields = await getYields();
        result = yields.data?.slice(0, 50) || yields.slice?.(0, 50) || yields;
        break;
      case "get_stablecoins":
        result = await getStablecoins();
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Crypto Market Data MCP server running on stdio");
}

main().catch(console.error);
