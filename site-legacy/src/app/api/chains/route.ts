import { NextRequest, NextResponse } from 'next/server';
import { CHAINS, getSupportedChainIds } from '@/lib/chains/config';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const includeProtocols = searchParams.get('protocols') === 'true';

  try {
    const chainIds = getSupportedChainIds();

    const chains = chainIds.map(id => {
      const chain = CHAINS[id];
      const result: any = {
        id: chain.id,
        name: chain.name,
        symbol: chain.symbol,
        color: chain.color,
        blockExplorer: chain.blockExplorer,
        nativeCurrency: chain.nativeCurrency,
      };

      if (includeProtocols) {
        result.protocols = chain.protocols;
      }

      return result;
    });

    return NextResponse.json({
      success: true,
      chains,
      total: chains.length,
    });
  } catch (error) {
    console.error('Chains API error:', error);

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch chains',
      },
    }, { status: 500 });
  }
}
