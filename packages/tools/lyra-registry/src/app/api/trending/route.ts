import { NextRequest, NextResponse } from 'next/server';
import { getDb, schema } from '@/db';
import { sql, desc, eq, gte, and } from 'drizzle-orm';
import { trendingQuerySchema, type ApiResponse } from '@/lib/validation';
import type { Tool } from '@/db/schema';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/trending - Get trending tools based on usage
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse and validate query params
    const queryResult = trendingQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!queryResult.success) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid query parameters',
        message: queryResult.error.message,
      }, { status: 400 });
    }

    const { period, limit, category } = queryResult.data;
    const db = getDb();

    // Calculate date threshold based on period
    const now = new Date();
    const periodDays = {
      day: 1,
      week: 7,
      month: 30,
    }[period];
    
    const threshold = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

    // Build conditions
    const conditions = [
      gte(schema.toolUsageLogs.createdAt, threshold),
    ];

    // Get trending tools by usage count
    const trendingData = await db
      .select({
        toolId: schema.toolUsageLogs.toolId,
        usageCount: sql<number>`count(*)`.as('usage_count'),
      })
      .from(schema.toolUsageLogs)
      .where(and(...conditions))
      .groupBy(schema.toolUsageLogs.toolId)
      .orderBy(desc(sql`usage_count`))
      .limit(limit * 2); // Get extra to filter by category

    if (trendingData.length === 0) {
      // Fallback: return top-scored tools if no usage data
      const fallbackConditions = category 
        ? eq(schema.tools.category, category)
        : undefined;

      const fallbackTools = await db
        .select()
        .from(schema.tools)
        .where(fallbackConditions)
        .orderBy(desc(schema.tools.totalScore), desc(schema.tools.downloadCount))
        .limit(limit);

      return NextResponse.json<ApiResponse<TrendingTool[]>>({
        success: true,
        data: fallbackTools.map(tool => ({
          ...tool,
          trendingScore: tool.totalScore || 0,
          recentUsage: 0,
        })),
        message: 'Showing top-rated tools (no recent usage data)',
      });
    }

    // Get tool details for trending IDs
    const toolIds = trendingData.map(t => t.toolId);
    
    let tools = await db
      .select()
      .from(schema.tools)
      .where(sql`${schema.tools.id} = ANY(ARRAY[${sql.join(toolIds.map(id => sql`${id}::uuid`), sql`, `)}])`);

    // Filter by category if specified
    if (category) {
      tools = tools.filter(t => t.category === category);
    }

    // Merge usage data with tools
    const usageMap = new Map(trendingData.map(t => [t.toolId, t.usageCount]));
    
    const trendingTools: TrendingTool[] = tools
      .map(tool => ({
        ...tool,
        trendingScore: (usageMap.get(tool.id) || 0) + (tool.totalScore || 0),
        recentUsage: usageMap.get(tool.id) || 0,
      }))
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, limit);

    return NextResponse.json<ApiResponse<TrendingTool[]>>({
      success: true,
      data: trendingTools,
    });

  } catch (error) {
    console.error('Error fetching trending tools:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

interface TrendingTool extends Tool {
  trendingScore: number;
  recentUsage: number;
}
