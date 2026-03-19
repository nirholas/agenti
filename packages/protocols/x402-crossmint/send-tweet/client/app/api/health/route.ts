import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const twitterConfigured = !!(
    process.env.TWITTER_CONSUMER_KEY &&
    process.env.TWITTER_CONSUMER_SECRET &&
    process.env.TWITTER_ACCESS_TOKEN &&
    process.env.TWITTER_ACCESS_TOKEN_SECRET
  );

  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    network: process.env.X402_NETWORK || 'base-sepolia',
    merchantAddress: process.env.MERCHANT_ADDRESS,
    twitterConfigured,
    endpoints: {
      tweet: `$${process.env.PRICE_USDC || '1'}`
    }
  });
}

