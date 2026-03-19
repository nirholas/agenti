import { NextRequest, NextResponse } from "next/server";
import { paymentMiddleware } from "x402-next";
import { facilitator } from "@coinbase/x402";
import { env } from "./lib/env";
import { getOrCreateSellerAccount } from "./lib/accounts";

const network = env.NETWORK;
const sellerAccount = await getOrCreateSellerAccount();

export const x402Middleware = paymentMiddleware(
  sellerAccount.address,
  {
    // pages
    "/blog": {
      price: "$0.001",
      network,
      config: {
        description: "Access to protected content",
      },
    },
    // api routes
    "/api/add": {
      price: "$0.005",
      network,
      config: {
        description: "Access to protected content",
      },
    },
  },
  facilitator
);

export default async function middleware(request: NextRequest) {
  // run middleware for all api routes
  if (request.nextUrl.pathname.startsWith("/api")) {
    return x402Middleware(request);
  } else {
    // for normal pages, only run middleware if it's a bot
    const isScraper = checkIsScraper(request);
    if (isScraper) {
      return x402Middleware(request);
    } else {
      return NextResponse.next();
    }
  }
}

function checkIsScraper(request: NextRequest) {
  const scraperRegex =
    /Bot|AI2Bot|Ai2Bot-Dolma|aiHitBot|Amazonbot|anthropic-ai|Applebot|Applebot-Extended|Brightbot 1.0|Bytespider|CCBot|ChatGPT-User|Claude-Web|ClaudeBot|cohere-ai|cohere-training-data-crawler|Cotoyogi|Crawlspace|Diffbot|DuckAssistBot|FacebookBot|Factset_spyderbot|FirecrawlAgent|FriendlyCrawler|Google-Extended|GoogleOther|GoogleOther-Image|GoogleOther-Video|GPTBot|iaskspider\/2.0|ICC-Crawler|ImagesiftBot|img2dataset|ISSCyberRiskCrawler|Kangaroo Bot|meta-externalagent|Meta-ExternalAgent|meta-externalfetcher|Meta-ExternalFetcher|NovaAct|OAI-SearchBot|omgili|omgilibot|Operator|PanguBot|Perplexity-User|PerplexityBot|PetalBot|Scrapy|SemrushBot-OCOB|SemrushBot-SWA|Sidetrade indexer bot|TikTokSpider|Timpibot|VelenPublicWebCrawler|Webzio-Extended|YouBot/i;

  const userAgent = request.headers.get("user-agent");
  const botUserAgent = scraperRegex.test(userAgent ?? "");

  const manualBot = request.nextUrl.searchParams.get("bot") === "true";

  return botUserAgent || manualBot;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
  runtime: "nodejs",
};
