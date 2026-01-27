import { NextResponse } from 'next/server';
import { getDb, schema } from '@/db';
import { sql } from 'drizzle-orm';
import { type ApiResponse } from '@/lib/validation';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  database: {
    connected: boolean;
    latency?: number;
  };
  stats: {
    totalTools: number;
    totalCategories: number;
    toolsByGrade: {
      a: number;
      b: number;
      f: number;
    };
    recentActivity: number;
  };
}

/**
 * GET /api/health - Health check endpoint
 */
export async function GET() {
  try {
    const db = getDb();
    
    // Test database connection
    const dbStart = Date.now();
    await db.execute(sql`SELECT 1 as test`);
    const dbLatency = Date.now() - dbStart;

    // Get stats
    const [toolStats] = await db
      .select({
        total: sql<number>`count(*)`,
        gradeA: sql<number>`count(*) FILTER (WHERE grade = 'a')`,
        gradeB: sql<number>`count(*) FILTER (WHERE grade = 'b')`,
        gradeF: sql<number>`count(*) FILTER (WHERE grade = 'f')`,
      })
      .from(schema.tools);

    const [categoryCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.categories);

    // Get recent activity (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [recentActivity] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.toolUsageLogs)
      .where(sql`${schema.toolUsageLogs.createdAt} > ${yesterday}`);

    const health: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: {
        connected: true,
        latency: dbLatency,
      },
      stats: {
        totalTools: Number(toolStats?.total || 0),
        totalCategories: Number(categoryCount?.count || 0),
        toolsByGrade: {
          a: Number(toolStats?.gradeA || 0),
          b: Number(toolStats?.gradeB || 0),
          f: Number(toolStats?.gradeF || 0),
        },
        recentActivity: Number(recentActivity?.count || 0),
      },
    };

    return NextResponse.json<ApiResponse<HealthStatus>>({
      success: true,
      data: health,
    });

  } catch (error) {
    console.error('Health check failed:', error);
    
    const health: HealthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: {
        connected: false,
      },
      stats: {
        totalTools: 0,
        totalCategories: 0,
        toolsByGrade: { a: 0, b: 0, f: 0 },
        recentActivity: 0,
      },
    };

    return NextResponse.json<ApiResponse<HealthStatus>>({
      success: false,
      data: health,
      error: error instanceof Error ? error.message : 'Health check failed',
    }, { status: 503 });
  }
}
