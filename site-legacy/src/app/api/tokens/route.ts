import { NextRequest, NextResponse } from 'next/server';
import { getTokensForChain, searchTokens, type TokenInfo } from '@/lib/tokens/lists';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chainId = parseInt(searchParams.get('chainId') || '1');
  const query = searchParams.get('q') || '';

  try {
    // Get tokens for chain
    const tokens = await getTokensForChain(chainId);

    // Apply search filter if query provided
    const filteredTokens = query ? searchTokens(tokens, query) : tokens.slice(0, 100);

    return NextResponse.json({
      success: true,
      chainId,
      tokens: filteredTokens,
      total: filteredTokens.length,
    });
  } catch (error) {
    console.error('Tokens API error:', error);

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch tokens',
      },
    }, { status: 500 });
  }
}
